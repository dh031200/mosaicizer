const App = {
    inference_session: null,
    nms_session: null,
    config: null,
    originalImageWidth: null,
    originalImageHeight: null,
    scaleX: null,
    scaleY: null,
    boxes: [],
    scoreThreshold: 0.25,
    currentFace: null,
    currentFilterType: "blur",
    currentSliderValue: 3,
    preprocessedFaces: {
        "mosaic": {},
        "blur": {}
    },
    pixelEnum: [10, 20, 40, 65, 95],
    introElement: document.getElementById("intro"),
    adContainerElement: document.getElementById("adContainer"),
    loadingOverlayElement: document.getElementById('loadingOverlay'),
    toolbarElement: document.getElementById("toolbar"),
    imageContainerElement: document.getElementById("imageContainer"),
    imageUploadContainerElement: document.getElementById("imageUploadContainer"),
    sliderElement: document.getElementById("pixelSizeSlider"),
    imageUploadElement: document.getElementById("imageUpload"),
    hiddenFileInputElement: document.getElementById("hiddenFileInput"),
    applyBtnElement: document.getElementById("applyBtn"),
    resetBtnElement: document.getElementById("resetBtn"),
    saveBtnElement: document.getElementById("saveBtn"),
    mosaicRadioElement: document.getElementById("mosaicRadio"),
    blurRadioElement: document.getElementById("blurRadio"),
    applyToAllElement: document.getElementById("allCheckbox"),
    uploadedImageElement: document.getElementById("uploadedImage"),
    previewCanvasElement: document.getElementById("preview"),
    resultElement: document.getElementById("result"),
    outputElement: document.getElementById("output"),
}

async function onOpenCvReady() {
    try {
        App.inference_session = await ort.InferenceSession.create("yolov8-face.onnx");
    } catch (error) {
        console.error("Failed to load the model:", error);
    }

    App.config = new ort.Tensor(
        "float32",
        new Float32Array([
            100, // topk per class
            0.45, // iou threshold
            App.scoreThreshold, // score threshold
        ]),
    ); // nms config tensor

    // Load the ONNX model when the page is loaded
    try {
        App.nms_session = await ort.InferenceSession.create("nms-yolov8.onnx");
    } catch (error) {
        console.error("Failed to load the model:", error);
    }
}

async function perf() {
    App.introElement.style.display = "none";
    App.adContainerElement.style.display = "block";
    App.toolbarElement.style.display = "flex";
    App.imageContainerElement.style.display = "flex";

    App.mosaicRadioElement.addEventListener("change", () => handleFilterChange("mosaic"));
    App.blurRadioElement.addEventListener("change", () => handleFilterChange("blur"));
    App.sliderElement.addEventListener("input", handleSliderInput);
    App.imageUploadElement.addEventListener("click", handleImageUpload);
    App.hiddenFileInputElement.addEventListener("change", handleFileInputChange);
    App.applyBtnElement.addEventListener("click", handleApplyBtnClick);
    App.resetBtnElement.addEventListener("click", handleResetBtnClick);
    App.saveBtnElement.addEventListener("click", handleSaveBtnClick);
}

function handleImageUpload() {
    App.hiddenFileInputElement.click();
}

function handleFileInputChange(e) {
    const file = e.target.files[0];
    const validExtensions = ['jpg', 'jpeg', 'png'];
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
        alert('Invalid file type. Please upload a JPG, JPEG or PNG image.');
        e.target.value = ''; // Reset the input
        return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
        const img = new Image();
        img.onload = function () {
            App.uploadedImageElement.src = event.target.result;

            App.imageUploadContainerElement.style.display = "none";
            App.imageContainerElement.style.border = "none";

            const maxWidth = App.imageContainerElement.clientWidth;

            const scaleFactor = maxWidth / this.width;
            const resizedWidth = this.width * scaleFactor;
            const resizedHeight = this.height * scaleFactor;

            App.previewCanvasElement.width = resizedWidth;
            App.previewCanvasElement.height = resizedHeight;
            const ctx = App.previewCanvasElement.getContext('2d');
            ctx.drawImage(img, 0, 0, resizedWidth, resizedHeight);

            App.previewCanvasElement.style.display = "block";

            // Enable the infer and reset buttons when an image is uploaded
            App.applyBtnElement.disabled = false;
            App.resetBtnElement.disabled = false;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
}

function handleSliderInput() {
    document.getElementById('pixelSizeValue').textContent = this.value;
    App.currentSliderValue = parseInt(App.sliderElement.value, 10) - 1;
    redrawFace();
}

async function handleApplyBtnClick() {
    showLoadingOverlay(true);

    setTimeout(async function () {
        if (App.inference_session) {
            try {
                await processImage();
            } catch (error) {
                console.error("Failed to run the model:", error);
            }
        } else {
            console.error("The model is not loaded yet.");
        }
    }, 10);
}

function handleResetBtnClick() {
    App.currentFace = null;
    App.currentSliderValue = 3
    App.preprocessedFaces = {
        "mosaic": {},
        "blur": {}
    };

    App.applyToAllElement.checked = true;

    // Clear the uploaded image
    App.hiddenFileInputElement.value = "";
    App.uploadedImageElement.src = "";
    App.uploadedImageElement.style.display = "none";
    App.resultElement.src = "";
    App.resultElement.style.display = "none";
    App.sliderElement.disabled = true;
    App.sliderElement.value = 3;
    document.getElementById("pixelSizeValue").textContent = "3";
    App.boxes = [];

    App.imageUploadContainerElement.style.display = "block";
    App.imageContainerElement.style.border = "3px dashed white";

    document.getElementById("clickMap").remove();
    const mapElement = document.createElement("map");
    mapElement.name = "clickMap";
    mapElement.id = "clickMap";
    App.imageContainerElement.appendChild(mapElement);

    // Clear the result image
    const rCtx = App.outputElement.getContext("2d");
    rCtx.clearRect(0, 0, App.outputElement.width, App.outputElement.height);
    const pCtx = App.previewCanvasElement.getContext("2d");
    App.previewCanvasElement.width = 0;
    App.previewCanvasElement.height = 0;

    pCtx.clearRect(0, 0, App.previewCanvasElement.width, App.previewCanvasElement.height);

    // Disable the infer, reset, and save buttons
    App.applyBtnElement.disabled = true;
    App.resetBtnElement.disabled = true;
    App.saveBtnElement.disabled = true;
}

function handleSaveBtnClick() {
    document.body.classList.add('inactive');
    setTimeout(async function () {
        applyFilterToOriginalImage();

        App.outputElement.width = App.uploadedImageElement.width; // Set the canvas width to the original image width
        App.outputElement.height = App.uploadedImageElement.height;
        // Draw the image onto the canvas
        const ctx = App.outputElement.getContext("2d");
        const img = document.getElementById("result");
        ctx.drawImage(img, 0, 0, App.uploadedImageElement.width, App.uploadedImageElement.height);

        // Save the image
        const link = document.createElement("a");
        link.download = "result.png";
        link.href = App.outputElement.toDataURL();
        link.click();
        setTimeout(() => {
            document.body.classList.remove('inactive');
        }, 100);
    });
}

const preprocessing = (source, modelWidth, modelHeight) => {
    const mat = cv.imread(source); // read from img tag
    const matC3 = new cv.Mat(mat.rows, mat.cols, cv.CV_8UC3); // new image matrix
    cv.cvtColor(mat, matC3, cv.COLOR_RGBA2BGR); // RGBA to BGR

    // padding image to [n x n] dim
    const maxSize = Math.max(matC3.rows, matC3.cols); // get max size from width and height
    const xPad = maxSize - matC3.cols, // set xPadding
        xRatio = maxSize / modelWidth; // set xRatio
    const yPad = maxSize - matC3.rows, // set yPadding
        yRatio = maxSize / modelHeight; // set yRatio
    const matPad = new cv.Mat(); // new mat for padded image
    cv.copyMakeBorder(matC3, matPad, 0, yPad, 0, xPad, cv.BORDER_CONSTANT); // padding black

    const input = cv.blobFromImage(
        matPad,
        1 / 255.0, // normalize
        new cv.Size(modelWidth, modelHeight), // resize to model input size
        new cv.Scalar(0, 0, 0),
        true, // swapRB
        false, // crop
    ); // preprocessing image matrix

    // release mat opencv
    mat.delete();
    matC3.delete();
    matPad.delete();

    return [input, xRatio, yRatio];
};

async function processImage() {
// Create an OpenCV Mat from the image
    const modelInputShape = [1, 3, 640, 640];
    const [modelWidth, modelHeight] = modelInputShape.slice(2);
    const [input, xRatio, yRatio] = preprocessing(
        App.uploadedImageElement,
        modelWidth,
        modelHeight,
    );

    const tensor = new ort.Tensor(
        "float32",
        input.data32F,
        modelInputShape,
    );
    const {output0} = await App.inference_session.run({images: tensor});
    const {selected} = await App.nms_session.run({
        detection: output0,
        config: App.config,
    });

    // Calculate the scale factors
    App.scaleX = App.previewCanvasElement.width / App.uploadedImageElement.naturalWidth;
    App.scaleY = App.previewCanvasElement.height / App.uploadedImageElement.naturalHeight;

    // looping through output
    for (let idx = 0; idx < selected.dims[1]; idx++) {
        const data = selected.data.slice(
            idx * selected.dims[2],
            (idx + 1) * selected.dims[2],
        ); // get rows
        const box = data.slice(0, 4);
        const scores = data.slice(4); // classes probability scores
        const score = Math.max(...scores); // maximum probability scores
        const label = scores.indexOf(score); // class id of maximum probability scores

        let [x, y, w, h] = [
            (box[0] - 0.5 * box[2]) * xRatio, // upscale left
            (box[1] - 0.5 * box[3]) * yRatio, // upscale top
            box[2] * xRatio, // upscale width
            box[3] * yRatio, // upscale height
        ]; // keep boxes in maxSize range

        App.boxes.push({
            label: label,
            probability: score,
            bounding: [x, y, w, h], // upscale box
        }); // update boxes to draw later
    }

    // const mat = cv.imread(App.uploadedImageElement); // read from img tag
    // const image = new cv.Mat(mat.rows, mat.cols, cv.CV_8UC3); // new image matrix
    // cv.cvtColor(mat, image, cv.COLOR_RGBA2BGR); // RGBA to BGR
    const mat = cv.imread(App.previewCanvasElement); // 원본 이미지 대신 썸네일 이미지로부터 OpenCV Mat 객체 생성
    const image = new cv.Mat(mat.rows, mat.cols, cv.CV_8UC3);
    cv.cvtColor(mat, image, cv.COLOR_RGBA2BGR);

    for (let filterType of ['mosaic', 'blur']) {
        for (let pixelIdx = 0; pixelIdx < 5; pixelIdx++) {
            let processedImage = image.clone();
            for (let i = 0; i < App.boxes.length; i++) {
                const box = App.boxes[i];
                let processedRoi = applyFilterWithPixelSizeAndFilterType(processedImage, box, pixelIdx, filterType);
                if (!App.preprocessedFaces[filterType][pixelIdx]) {
                    App.preprocessedFaces[filterType][pixelIdx] = [];
                }
                App.preprocessedFaces[filterType][pixelIdx].push(processedRoi);
            }
            processedImage.delete();
        }
    }

    for (let i = 0; i < App.boxes.length; i++) {
        let originalImage = image.clone();

        const box = App.boxes[i];

        // Define the bounding box coordinates
        let x = box.bounding[0] * App.scaleX;
        let y = box.bounding[1] * App.scaleY;
        let w = box.bounding[2] * App.scaleX;
        let h = box.bounding[3] * App.scaleY;

        // Store the original and filtered regions
        // Create an area element for the face
        let faceArea = document.createElement("area");
        faceArea.shape = "rect";
        // faceArea.coords = `${x * App.scaleX},${y * App.scaleY},${x * App.scaleX + w * App.scaleX},${y * App.scaleY + h * App.scaleY}`;
        faceArea.coords = `${x},${y},${x + w},${y + h}`;

        let roi = image.roi(new cv.Rect(x, y, w, h));

        let originalRegion = originalImage.roi(new cv.Rect(x, y, w, h));
        // Define the region of interest in the filtered image

        // Add an event listener to the face
        faceArea.addEventListener("click", function () {
            if (!App.applyToAllElement.checked) {
                App.currentFace = this;
            }
            // Subtract the original region from the current region
            let difference = new cv.Mat();
            cv.subtract(roi, originalRegion, difference);

            // Calculate the norm of the difference
            let norm = cv.norm(difference, cv.NORM_L1);

            // Check if the current region is the original or the filtered region
            if (norm === 0) {
                // If it's the original region, get the preprocessed image from preprocessedFaces
                let preprocessedRoi = App.preprocessedFaces[App.currentFilterType][App.currentSliderValue][i]; // i is the index of the current box
                preprocessedRoi.copyTo(roi);
            } else {
                // If it's the filtered region, replace it with the original region
                originalRegion.copyTo(roi);
            }

            const rgbMat = new cv.Mat();
            cv.cvtColor(image, rgbMat, cv.COLOR_BGR2RGBA);
            cv.imshow("output", rgbMat);

            App.resultElement.src = App.outputElement.toDataURL();

            // Clean up
            difference.delete();
        });
        document.getElementById("clickMap").appendChild(faceArea);
    }

    cv.imshow("output", mat);
    App.resultElement.src = App.outputElement.toDataURL();

    App.resultElement.style.display = "block";

    for (let clickArea of document.getElementById("clickMap").children) {
        clickArea.click();
    }

    // Hide the loading overlay
    hideLoadingOverlay();

    // Enable the save button when the inference is done
    App.saveBtnElement.disabled = false;

    // Hide the uploaded image
    App.previewCanvasElement.style.display = "none";

    App.sliderElement.disabled = false;
    App.applyBtnElement.disabled = true;
}

function applyFilterWithPixelSizeAndFilterType(image, box, pixelIdx, filterType) {
    let pixelSize = App.pixelEnum[pixelIdx];
    let [x, y, w, h] = box.bounding;
    x = x * App.scaleX;
    y = y * App.scaleY;
    w = w * App.scaleX;
    h = h * App.scaleY;

    let mask = new cv.Mat.zeros(h, w, cv.CV_8UC1);
    cv.ellipse(mask, new cv.Point(w / 2, h / 2), new cv.Size(w / 2, h / 2), 0, 0, 360, new cv.Scalar(255, 255, 255), -1);
    let roi = image.roi(new cv.Rect(x, y, w, h));
    let roiClone = roi.clone();

    if (filterType === 'mosaic') {
        let pixelated = new cv.Mat();
        cv.resize(roiClone, pixelated, new cv.Size(Math.floor(w / pixelSize), Math.floor(h / pixelSize)), 0, 0, cv.INTER_LINEAR);
        cv.resize(pixelated, pixelated, new cv.Size(w, h), 0, 0, cv.INTER_NEAREST);
        pixelated.copyTo(roiClone, mask);
        pixelated.delete();
    } else if (filterType === 'blur') {
        let blurred = new cv.Mat();
        pixelSize = pixelSize * 3;
        pixelSize = pixelSize % 2 === 0 ? pixelSize + 1 : pixelSize;
        let ksize = new cv.Size(pixelSize, pixelSize);
        cv.GaussianBlur(roiClone, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);
        blurred.copyTo(roiClone, mask);
        blurred.delete();
    }

    roiClone.copyTo(roi);
    roi.delete();
    mask.delete();
    return roiClone;
}

function redrawFace() {
    showLoadingOverlay(false);
    setTimeout(async function () {
        if (App.applyToAllElement.checked) {
            for (let clickArea of document.getElementById("clickMap").children) {
                clickArea.click();
                clickArea.click();
            }
        } else {
            if (App.currentFace) {
                App.currentFace.click();
                App.currentFace.click();
            }
        }
        // Hide the loading overlay and unblock clicks
        hideLoadingOverlay();
    }, 2);
}

function applyFilterToOriginalImage() {
    const mat = cv.imread(App.uploadedImageElement); // 원본 이미지로부터 OpenCV Mat 객체 생성
    const image = new cv.Mat(mat.rows, mat.cols, cv.CV_8UC3);
    cv.cvtColor(mat, image, cv.COLOR_RGBA2BGR);

    for (let i = 0; i < App.boxes.length; i++) {
        const box = App.boxes[i];
        let roi = image.roi(new cv.Rect(box.bounding[0], box.bounding[1], box.bounding[2], box.bounding[3]));
        let processedRoi = applyFilterWithPixelSizeAndFilterType(image, box, App.currentSliderValue, App.currentFilterType);
        processedRoi.copyTo(roi);
        roi.delete();
        processedRoi.delete();
    }

    const rgbMat = new cv.Mat();
    cv.cvtColor(image, rgbMat, cv.COLOR_BGR2RGBA);
    cv.imshow("output", rgbMat);

    mat.delete();
    image.delete();
    rgbMat.delete();
}


function handleFilterChange(filterType) {
    App.currentFilterType = filterType;
    redrawFace();
}

function showLoadingOverlay(overlay) {
    document.body.classList.add('inactive');
    if (overlay) {
        App.loadingOverlayElement.style.display = 'block';
    }
}

function hideLoadingOverlay() {
    App.loadingOverlayElement.style.display = 'none';
    setTimeout(() => {
        document.body.classList.remove('inactive');
    }, 100);
}

async function main() {
    if (cv instanceof Promise) {
        cv = await cv;
        await perf();
    } else {
        cv.onRuntimeInitialized = perf;
    }
    await onOpenCvReady();
}

let pathsConfig = {
    wasm: "./build_wasm/opencv.js"
}
loadOpenCV(pathsConfig, main);
