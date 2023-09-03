const App = {
  isMobile: false,
  downloadLink: null,
  latestVersion: 9,
  inference_session: null,
  nms_session: null,
  config: null,
  originalImageWidth: null,
  originalImageHeight: null,
  scale: null,
  boxes: [],
  isApplied: [],
  appliedMethod: [],
  scoreThreshold: 0.25,
  currentFace: null,
  currentFilterType: "blur",
  currentSliderValue: 3,
  preprocessedFaces: {
    mosaic: {},
    blur: {},
  },
  pixelEnum: [10, 20, 40, 65, 95],
  borderStyle: null,
  introElement: document.getElementById("intro"),
  adContainerElement: document.getElementById("adContainer"),
  appVersion: document.getElementById("appVersion"),
  versionCheckBtnElement: document.getElementById("versionBtn"),
  modal: document.getElementById("myModal"),
  closeBtn: document.getElementsByClassName("close")[0],
  updateBtn: document.getElementById("updateBtn"),
  exitBtn: document.getElementById("exitBtn"),
  loadingOverlayElement: document.getElementById("loadingOverlay"),
  downloadingOverlayElement: document.getElementById("downloadingOverlay"),
  toolbarElement: document.getElementById("toolbar"),
  imageContainerElement: document.getElementById("imageContainer"),
  imageUploadContainerElement: document.getElementById("imageUploadContainer"),
  sliderElement: document.getElementById("pixelSizeSlider"),
  imageUploadElement: document.getElementById("imageUpload"),
  hiddenFileInputElement: document.getElementById("hiddenFileInput"),
  applyBtnElement: document.getElementById("applyBtn"),
  resetBtnElement: document.getElementById("resetBtn"),
  saveBtnElement: document.getElementById("saveBtn"),
  mosaicBtnElement: document.getElementById("mosaicBtn"),
  blurBtnElement: document.getElementById("blurBtn"),
  applyToAllElement: document.getElementById("allCheckbox"),
  uploadedImageElement: document.getElementById("uploadedImage"),
  previewCanvasElement: document.getElementById("preview"),
  resultElement: document.getElementById("result"),
  outputElement: document.getElementById("output"),
};

async function onOpenCvReady() {
  try {
    App.inference_session =
      await ort.InferenceSession.create("yolov8-face.onnx");
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
  App.borderStyle = App.imageContainerElement.style.border;

  App.versionCheckBtnElement.addEventListener("click", appVersionCheck);
  App.updateBtn.addEventListener("click", updateBtnEventHandler);
  App.exitBtn.addEventListener("click", hideModal);
  App.mosaicBtnElement.addEventListener("click", () =>
    handleFilterChange("mosaic"),
  );
  App.blurBtnElement.addEventListener("click", () =>
    handleFilterChange("blur"),
  );

  App.sliderElement.addEventListener("input", handleSliderInput);
  App.imageUploadElement.addEventListener("click", handleImageUpload);
  App.hiddenFileInputElement.addEventListener("change", handleFileInputChange);
  App.applyBtnElement.addEventListener("click", handleApplyBtnClick);
  App.resetBtnElement.addEventListener("click", handleResetBtnClick);
  App.saveBtnElement.addEventListener("click", handleSaveBtnClick);

  if (App.appVersion.value === "") {
    App.appVersion.value = "0";
  }

  setTimeout(function () {
    App.versionCheckBtnElement.click();
  }, 2000);
}

function removeEventListeners() {
  App.saveBtnElement.removeEventListener("click", handleSaveBtnClick);
  App.updateBtn.removeEventListener("click", updateBtnEventHandler);
  App.exitBtn.removeEventListener("click", hideModal);
}

function updateBtnEventHandler() {
  window.open(
    "https://play.google.com/store/apps/details?id=com.twodevteam.mosaicizer",
    "_blank",
  );
}

function showModal() {
  document.getElementById(
    "appVersionLabel",
  ).textContent = `App version : ${App.appVersion.value}`;
  App.modal.style.display = "block";
  App.adContainerElement.style.display = "block";
  App.toolbarElement.style.display = "none";
  App.imageContainerElement.style.display = "none";
}

function hideModal() {
  App.modal.style.display = "none";
}

function appVersionCheck() {
  if (App.isMobile && parseInt(App.appVersion.value) < App.latestVersion) {
    removeEventListeners();
    showModal();
  }
}

function handleImageUpload() {
  App.hiddenFileInputElement.click();
}

function handleFileInputChange(e) {
  const file = e.target.files[0];
  const validExtensions = ["jpg", "jpeg", "png"];
  const fileExtension = file.name.split(".").pop().toLowerCase();

  if (!validExtensions.includes(fileExtension)) {
    alert("Invalid file type. Please upload a JPG, JPEG or PNG image.");
    e.target.value = ""; // Reset the input
    return;
  }

  const reader = new FileReader();
  reader.onload = function (event) {
    const img = new Image();
    img.onload = function () {
      App.uploadedImageElement.src = event.target.result;

      App.imageUploadContainerElement.style.display = "none";
      App.imageContainerElement.style.border = "none";

      const imageAspectRatio = this.width / this.height;
      const containerAspectRatio =
        App.imageContainerElement.clientWidth /
        App.imageContainerElement.clientHeight;

      let scaleFactor;
      if (imageAspectRatio > containerAspectRatio) {
        scaleFactor = App.imageContainerElement.clientWidth / this.width;
      } else {
        scaleFactor = App.imageContainerElement.clientHeight / this.height;
      }

      const resizedWidth = this.width * scaleFactor;
      const resizedHeight = this.height * scaleFactor;

      App.previewCanvasElement.width = resizedWidth;
      App.previewCanvasElement.height = resizedHeight;
      const ctx = App.previewCanvasElement.getContext("2d");
      ctx.drawImage(img, 0, 0, resizedWidth, resizedHeight);

      App.previewCanvasElement.style.display = "block";

      // Enable the infer and reset buttons when an image is uploaded
      App.applyBtnElement.classList.remove("toolbarBtnDisabled");
      App.resetBtnElement.classList.remove("toolbarBtnDisabled");
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(e.target.files[0]);
}

function handleSliderInput() {
  document.getElementById("pixelSizeValue").textContent = this.value;
  App.currentSliderValue = parseInt(App.sliderElement.value, 10) - 1;
  redrawFace();
}

async function handleApplyBtnClick() {
  showLoadingOverlay(true, "load");

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
  }, 50);
}

function handleResetBtnClick() {
  App.currentFace = null;
  App.currentSliderValue = 3;
  App.preprocessedFaces = {
    mosaic: {},
    blur: {},
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
  App.isApplied = [];
  App.appliedMethod = [];
  App.downloadLink = null;
  App.scale = null;

  App.imageUploadContainerElement.style.display = "flex";
  App.imageContainerElement.style.border = App.borderStyle;

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

  pCtx.clearRect(
    0,
    0,
    App.previewCanvasElement.width,
    App.previewCanvasElement.height,
  );

  // Disable the infer, reset, and save buttons
  App.applyBtnElement.classList.add("toolbarBtnDisabled");
  App.resetBtnElement.classList.add("toolbarBtnDisabled");
  App.saveBtnElement.classList.add("toolbarBtnDisabled");
}

async function handleSaveBtnClick() {
  showLoadingOverlay(true, "download");
  setTimeout(async function () {
    App.outputElement.width = App.uploadedImageElement.width; // Set the canvas width to the original image width
    App.outputElement.height = App.uploadedImageElement.height;
    applyFilterToOriginalImage();
    const link = document.createElement("a");
    link.download = "result.png";
    link.href = App.outputElement.toDataURL();
    App.downloadLink = link.href;
    if (!App.isMobile) {
      link.click();
      hideLoadingOverlay();
    }
  }, 100);
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

  const tensor = new ort.Tensor("float32", input.data32F, modelInputShape);
  const { output0 } = await App.inference_session.run({ images: tensor });
  const { selected } = await App.nms_session.run({
    detection: output0,
    config: App.config,
  });

  // Calculate the scale factors
  App.scale =
    App.previewCanvasElement.width / App.uploadedImageElement.naturalWidth;

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
      Math.max(0, (box[0] - 0.5 * box[2]) * xRatio), // upscale left
      Math.max(0, (box[1] - 0.5 * box[3]) * yRatio), // upscale top
      Math.max(0, box[2] * xRatio), // upscale width
      Math.max(0, box[3] * yRatio), // upscale height
    ]; // keep boxes in maxSize range

    w -= Math.max(0, x + w - App.uploadedImageElement.naturalWidth);
    h -= Math.max(0, y + h - App.uploadedImageElement.naturalHeight);

    App.boxes.push({
      label: label,
      probability: score,
      bounding: [x, y, w, h], // upscale box
    }); // update boxes to draw later
  }

  const mat = cv.imread(App.previewCanvasElement); // 원본 이미지 대신 썸네일 이미지로부터 OpenCV Mat 객체 생성
  const image = new cv.Mat(mat.rows, mat.cols, cv.CV_8UC3);
  cv.cvtColor(mat, image, cv.COLOR_RGBA2BGR);

  for (let filterType of ["mosaic", "blur"]) {
    for (let pixelIdx = 0; pixelIdx < 5; pixelIdx++) {
      let processedImage = image.clone();
      for (let i = 0; i < App.boxes.length; i++) {
        const box = App.boxes[i];
        let processedRoi = applyFilterWithPixelSizeAndFilterType(
          processedImage,
          box,
          pixelIdx,
          filterType,
          true,
        );
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
    let x = box.bounding[0] * App.scale;
    let y = box.bounding[1] * App.scale;
    let w = box.bounding[2] * App.scale;
    let h = box.bounding[3] * App.scale;

    // Store the original and filtered regions
    // Create an area element for the face
    let faceArea = document.createElement("area");
    faceArea.setAttribute("clicked", "false");
    faceArea.shape = "rect";
    faceArea.coords = `${x},${y},${x + w},${y + h}`;

    let roi = image.roi(new cv.Rect(x, y, w, h));

    let originalRegion = originalImage.roi(new cv.Rect(x, y, w, h));
    // Define the region of interest in the filtered image

    // Add an event listener to the face
    faceArea.addEventListener("click", function () {
      if (!App.applyToAllElement.checked) {
        App.currentFace = this;
      }
      App.isApplied[i] = !App.isApplied[i];

      // Check if the current region is the original or the filtered region
      if (this.getAttribute("clicked") === "false") {
        // If it's the original region, get the preprocessed image from preprocessedFaces
        let preprocessedRoi =
          App.preprocessedFaces[App.currentFilterType][App.currentSliderValue][
            i
          ]; // i is the index of the current box
        App.appliedMethod[i].method = App.currentFilterType;
        App.appliedMethod[i].pixelIdx = App.currentSliderValue;
        preprocessedRoi.copyTo(roi);
        this.setAttribute("clicked", "true");
      } else {
        this.setAttribute("clicked", "false");
        // If it's the filtered region, replace it with the original region
        originalRegion.copyTo(roi);
      }

      const rgbMat = new cv.Mat();
      cv.cvtColor(image, rgbMat, cv.COLOR_BGR2RGBA);
      cv.imshow("preview", rgbMat);

      App.resultElement.src = App.previewCanvasElement.toDataURL();
    });
    document.getElementById("clickMap").appendChild(faceArea);
    App.isApplied.push(false);
    App.appliedMethod.push({
      method: App.currentFilterType,
      pixelIdx: App.currentSliderValue,
    });
  }

  cv.imshow("preview", mat);
  App.resultElement.src = App.previewCanvasElement.toDataURL();
  App.resultElement.style.display = "block";

  for (let clickArea of document.getElementById("clickMap").children) {
    clickArea.click();
  }

  // Hide the loading overlay
  hideLoadingOverlay();

  // Hide the uploaded image
  App.previewCanvasElement.style.display = "none";
  App.sliderElement.disabled = false;

  // Enable the save button when the inference is done
  App.applyBtnElement.classList.add("toolbarBtnDisabled");
  App.saveBtnElement.classList.remove("toolbarBtnDisabled");
}

function applyFilterWithPixelSizeAndFilterType(
  image,
  box,
  pixelIdx,
  filterType,
  thumbnail,
) {
  let pixelSize = App.pixelEnum[pixelIdx];
  let [x, y, w, h] = box.bounding;
  if (thumbnail) {
    x = x * App.scale;
    y = y * App.scale;
    w = w * App.scale;
    h = h * App.scale;
    pixelSize = Math.max(parseInt(pixelSize * App.scale), 2);
  }
  pixelSize = Math.min(pixelSize, parseInt(Math.min(w, h)));

  let mask = new cv.Mat.zeros(h, w, cv.CV_8UC1);
  cv.ellipse(
    mask,
    new cv.Point(w / 2, h / 2),
    new cv.Size(w / 2, h / 2),
    0,
    0,
    360,
    new cv.Scalar(255, 255, 255),
    -1,
  );
  let roi = image.roi(new cv.Rect(x, y, w, h));
  let roiClone = roi.clone();
  if (filterType === "mosaic") {
    let pixelated = new cv.Mat();
    cv.resize(
      roiClone,
      pixelated,
      new cv.Size(Math.floor(w / pixelSize), Math.floor(h / pixelSize)),
      0,
      0,
      cv.INTER_LINEAR,
    );
    cv.resize(pixelated, pixelated, new cv.Size(w, h), 0, 0, cv.INTER_NEAREST);
    pixelated.copyTo(roiClone, mask);
    pixelated.delete();
  } else if (filterType === "blur") {
    let blurred = new cv.Mat();

    pixelSize = pixelSize * 3;
    pixelSize = Math.min(pixelSize, parseInt(Math.min(w, h)));
    pixelSize = pixelSize % 2 === 0 ? pixelSize - 1 : pixelSize;

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
  showLoadingOverlay(false, "load");
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
  }, 50);
}

function applyFilterToOriginalImage() {
  const mat = cv.imread(App.uploadedImageElement); // 원본 이미지로부터 OpenCV Mat 객체 생성
  const image = new cv.Mat(mat.rows, mat.cols, cv.CV_8UC3);
  cv.cvtColor(mat, image, cv.COLOR_RGBA2BGR);

  for (let i = 0; i < App.boxes.length; i++) {
    if (App.isApplied[i]) {
      const box = App.boxes[i];
      let [x, y, w, h] = box.bounding;

      let roi = image.roi(new cv.Rect(x, y, w, h));

      let processedRoi = applyFilterWithPixelSizeAndFilterType(
        image,
        box,
        App.appliedMethod[i].pixelIdx,
        App.appliedMethod[i].method,
        false,
      );
      processedRoi.copyTo(roi);
      roi.delete();
      processedRoi.delete();
    }
  }

  const rgbMat = new cv.Mat();
  cv.cvtColor(image, rgbMat, cv.COLOR_BGR2RGBA);
  cv.imshow("output", rgbMat);

  mat.delete();
  image.delete();
  rgbMat.delete();
}

function handleFilterChange(filterType) {
  if (filterType === "blur") {
    App.blurBtnElement.disabled = true;
    App.mosaicBtnElement.disabled = false;
  } else {
    App.blurBtnElement.disabled = false;
    App.mosaicBtnElement.disabled = true;
  }
  App.currentFilterType = filterType;
  redrawFace();
}

function showLoadingOverlay(overlay, method) {
  document.body.classList.add("inactive");
  if (overlay) {
    if (method === "download") {
      App.downloadingOverlayElement.style.display = "block";
    } else {
      App.loadingOverlayElement.style.display = "block";
    }
  }
}

function hideLoadingOverlay() {
  App.loadingOverlayElement.style.display = "none";
  App.downloadingOverlayElement.style.display = "none";
  setTimeout(() => {
    document.body.classList.remove("inactive");
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
  wasm: "./build_wasm/opencv.js",
};
loadOpenCV(pathsConfig, main);
