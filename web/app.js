let inference_session;
let nms_session;
let config;
let originalImageWidth;
let originalImageHeight;
let scaleX, scaleY;
const boxes = []; // Define the 'boxes' variable in a higher scope

async function onOpenCvReady() {
  try {
    inference_session = await ort.InferenceSession.create("yolov8-face.onnx");
  } catch (error) {
    console.error("Failed to load the model:", error);
  }

  config = new ort.Tensor(
    "float32",
    new Float32Array([
      100, // topk per class
      0.45, // iou threshold
      0.25, // score threshold
    ]),
  ); // nms config tensor

  // Load the ONNX model when the page is loaded
  try {
    nms_session = await ort.InferenceSession.create("nms-yolov8.onnx");
  } catch (error) {
    console.error("Failed to load the model:", error);
  }
}

window.onload = async function () {
  // Get references to the buttons
  const inferBtn = document.getElementById("inferBtn");
  const resetBtn = document.getElementById("resetBtn");
  const saveBtn = document.getElementById("saveBtn");

  document.getElementById("imageUpload").addEventListener("click", function () {
    document.getElementById("hiddenFileInput").click();
  });

  document.getElementById("hiddenFileInput").addEventListener(
    "change",
    function (e) {
      const reader = new FileReader();
      reader.onload = function (event) {
        const img = new Image();
        img.onload = function () {
          originalImageWidth = this.naturalWidth; // Store the original image width
          originalImageHeight = this.naturalHeight; // Store the original image height

          const src = document.getElementById("uploadedImage");
          const dst = document.getElementById("preview");
          src.src = event.target.result;

          // Enable the infer and reset buttons when an image is uploaded
          inferBtn.disabled = false;
          resetBtn.disabled = false;

          // Show the uploaded image
          const mat = cv.imread(src);
          const image = new cv.Mat(mat.rows, mat.cols, cv.CV_8UC3); // new image matrix
          cv.cvtColor(mat, image, cv.COLOR_RGBA2RGB); // RGBA to BGR
          cv.imshow("preview", image);
          dst.style.display = "block";
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(e.target.files[0]);
    },
    false,
  );

  inferBtn.addEventListener("click", async function () {
    const src = document.getElementById("uploadedImage");
    // const preview = document.getElementById('preview')
    const dst = document.getElementById("result");
    const output = document.getElementById("output");

    document.getElementById("clickMap").remove();
    const mapElement = document.createElement("map");
    mapElement.name = "clickMap";
    mapElement.id = "clickMap";
    document.getElementById("imageContainer").appendChild(mapElement);

    // Show the loading overlay
    document.getElementById("loadingOverlay").style.display = "block";

    // dst.src = '';
    // dst.style.display = 'none';
    // const resultCanvas = document.getElementById('output');
    // const rCtx = resultCanvas.getContext('2d');
    // rCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);

    if (inference_session) {
      setTimeout(async function () {
        try {
          // Create an OpenCV Mat from the image
          const modelInputShape = [1, 3, 640, 640];
          const [modelWidth, modelHeight] = modelInputShape.slice(2);
          const [input, xRatio, yRatio] = preprocessing(
            src,
            modelWidth,
            modelHeight,
          );

          const tensor = new ort.Tensor(
            "float32",
            input.data32F,
            modelInputShape,
          );
          const { output0 } = await inference_session.run({ images: tensor });
          const { selected } = await nms_session.run({
            detection: output0,
            config: config,
          });

          // // Calculate the scale factors
          const previewImage = document.getElementById("preview");
          if (previewImage.style.display === "none") {
            scaleX = dst.clientWidth / originalImageWidth;
            scaleY = dst.clientHeight / originalImageHeight;
          } else {
            scaleX = previewImage.clientWidth / originalImageWidth;
            scaleY = previewImage.clientHeight / originalImageHeight;
          }

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

            boxes.push({
              label: label,
              probability: score,
              bounding: [x, y, w, h], // upscale box
            }); // update boxes to draw later
          }

          const mat = cv.imread(src); // read from img tag
          const image = new cv.Mat(mat.rows, mat.cols, cv.CV_8UC3); // new image matrix
          cv.cvtColor(mat, image, cv.COLOR_RGBA2BGR); // RGBA to BGR

          let originalImage = image.clone();

          while (boxes.length > 0) {
            const box = boxes.pop();
            applyFilter(image, box);

            // Define the bounding box coordinates
            let x = box.bounding[0];
            let y = box.bounding[1];
            let w = box.bounding[2];
            let h = box.bounding[3];

            // Create a area element for the face
            let faceArea = document.createElement("area");
            faceArea.shape = "rect";
            faceArea.coords = `${x * scaleX},${y * scaleY},${
              x * scaleX + w * scaleX
            },${y * scaleY + h * scaleY}`;

            // Define the region of interest in the filtered image
            let roi = image.roi(new cv.Rect(x, y, w, h));

            // Store the original and filtered regions
            let originalRegion = originalImage.roi(new cv.Rect(x, y, w, h));
            let filteredRegion = roi.clone();

            // Add an event listener to the face
            faceArea.addEventListener("click", function () {
              // Subtract the original region from the current region
              let difference = new cv.Mat();
              cv.subtract(roi, originalRegion, difference);

              // Calculate the norm of the difference
              let norm = cv.norm(difference, cv.NORM_L1);

              // Check if the current region is the original or the filtered region
              if (norm === 0) {
                // If it's the original region, replace it with the filtered region
                filteredRegion.copyTo(roi);
              } else {
                // If it's the filtered region, replace it with the original region
                originalRegion.copyTo(roi);
              }

              const rgbMat = new cv.Mat();
              cv.cvtColor(image, rgbMat, cv.COLOR_BGR2RGBA);
              cv.imshow("output", rgbMat);

              dst.src = output.toDataURL();

              // Clean up
              difference.delete();
            });
            document.getElementById("clickMap").appendChild(faceArea);
          }

          const imgWithAlpha = new cv.Mat();
          cv.cvtColor(image, imgWithAlpha, cv.COLOR_BGR2RGBA);

          cv.imshow("output", imgWithAlpha);
          dst.src = output.toDataURL();

          dst.style.display = "block";

          // Hide the loading overlay
          document.getElementById("loadingOverlay").style.display = "none";

          // Enable the save button when the inference is done
          saveBtn.disabled = false;

          // Hide the uploaded image
          document.getElementById("preview").style.display = "none";

          // Clean up
          input.delete(); // delete unused Mat
        } catch (error) {
          console.error("Failed to run the model:", error);
        }
      }, 0);
    } else {
      console.error("The model is not loaded yet.");
    }
  });

  resetBtn.addEventListener("click", function () {
    // Clear the uploaded image
    document.getElementById("hiddenFileInput").value = "";
    document.getElementById("uploadedImage").src = "";
    document.getElementById("uploadedImage").style.display = "none";
    document.getElementById("result").src = "";
    document.getElementById("result").style.display = "none";

    document.getElementById("clickMap").remove();
    const mapElement = document.createElement("map");
    mapElement.name = "clickMap";
    mapElement.id = "clickMap";
    document.getElementById("imageContainer").appendChild(mapElement);

    // Clear the result image
    const resultCanvas = document.getElementById("output");
    const previewCanvas = document.getElementById("preview");
    const rCtx = resultCanvas.getContext("2d");
    rCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
    const pCtx = previewCanvas.getContext("2d");
    pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    // Disable the infer, reset, and save buttons
    inferBtn.disabled = true;
    resetBtn.disabled = true;
    saveBtn.disabled = true;
  });

  saveBtn.addEventListener("click", function () {
    const resultCanvas = document.getElementById("output");
    const originalImage = document.getElementById("uploadedImage");
    const originalImageWidth = originalImage.width;
    const originalImageHeight = originalImage.height;
    resultCanvas.width = originalImageWidth; // Set the canvas width to the original image width
    resultCanvas.height = originalImageHeight;
    // Draw the image onto the canvas
    const ctx = resultCanvas.getContext("2d");
    const img = document.getElementById("result");
    ctx.drawImage(img, 0, 0, originalImageWidth, originalImageHeight);

    // Save the image
    const link = document.createElement("a");
    link.download = "result.png";
    link.href = resultCanvas.toDataURL();
    link.click();
  });
};

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

function applyFilter(image, box) {
  const mosaicRadio = document.getElementById("mosaicRadio");
  const blurRadio = document.getElementById("blurRadio");
  const pixelSizeInput = document.getElementById("pixelSizeInput");
  let pixelSize = parseInt(pixelSizeInput.value, 10);

  // Extract the bounding box coordinates
  const [x, y, w, h] = box.bounding;

  // Create an empty mask the same size as the region of interest
  let mask = new cv.Mat.zeros(h, w, cv.CV_8UC1);

  // Draw an ellipse on the mask the same size as the region of interest
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

  // Extract the region of interest (ROI) from the image
  let roi = image.roi(new cv.Rect(x, y, w, h));

  // Clone the ROI to create an image to which the mask will be applied
  let roiClone = roi.clone();

  if (mosaicRadio.checked) {
    // Resize the ROI to a smaller size to cause pixelation
    let pixelated = new cv.Mat();
    cv.resize(
      roiClone,
      pixelated,
      new cv.Size(Math.floor(w / pixelSize), Math.floor(h / pixelSize)),
      0,
      0,
      cv.INTER_LINEAR,
    );

    // Resize the pixelated ROI back to the original size
    cv.resize(pixelated, pixelated, new cv.Size(w, h), 0, 0, cv.INTER_NEAREST);

    // Copy the pixelated image to the ROI in the cloned image using the mask
    pixelated.copyTo(roiClone, mask);

    pixelated.delete();
  } else if (blurRadio.checked) {
    // Create a blurred image
    let blurred = new cv.Mat();
    pixelSize = pixelSize * 4;
    pixelSize = pixelSize % 2 === 0 ? pixelSize + 1 : pixelSize; // Ensure pixelSize is odd

    let ksize = new cv.Size(pixelSize, pixelSize);
    cv.GaussianBlur(roiClone, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);

    // Copy the blurred image to the ROI in the cloned image using the mask
    blurred.copyTo(roiClone, mask);

    blurred.delete();
  }

  // Replace the ROI in the original image with the pixelated or blurred ROI
  roiClone.copyTo(roi);

  // Clean up
  roi.delete();
  roiClone.delete();
  mask.delete();
}
