# Mosaicizer

Landing Page: https://www.2devteam.com/en/mosaicizer  

Mosaicizer is an open-source project designed to automatically pixelate and blur faces in images, adding a touch of privacy and anonymity. By leveraging the power of YOLOv8, WebAssembly, and OpenCV.js, it provides a seamless face recognition and automation experience. Developed initially as a web app, it has been distributed for iOS and Android platforms using Flutter.

## **Features:**

1. **Open Source**: Dive into the code and customize it according to your needs.
2. **YOLOv8 Integration**: Utilizes YOLOv8 for quick and accurate face recognition.
3. **WebAssembly & OpenCV.js**: Ensures efficient processing and operations.
4. **Cross-Platform**: Available as a web app and also distributed for iOS and Android using Flutter.

## **Highlights:**

1. **Privacy and Anonymity**: Automatically pixelate and blur faces in images, ensuring user privacy.
2. **Data Privacy**: Mosaicizer is secure, with no servers collecting your data.
3. **Artificial Intelligence**: YOLOv8 leverages AI for rapid and precise face recognition and automation.
4. **User-Friendly**: Designed with a simple and intuitive interface, making it easy even for non-tech users.

## **Operating Principles:**

- **YOLOv8**: This project uses YOLOv8 for face detection. YOLO (You Only Look Once) is a state-of-the-art, real-time object detection system. In this project, it's specifically tailored for face recognition.
- **WebAssembly**: WebAssembly allows code to run at near-native speed, which is crucial for processing-intensive tasks like image processing.
- **OpenCV.js**: OpenCV (Open Source Computer Vision Library) is an open-source computer vision and machine learning software library. The project uses its JavaScript version to perform various operations.

## **Operation Process:**

1. The user uploads an image through the web interface.
2. YOLOv8 processes the image to detect faces.
3. OpenCV.js is used for further image processing tasks, including pixelation and blurring.
4. The processed image is then displayed back to the user, with faces pixelated for privacy.

## **Getting Started:**

1. Clone the repository.
2. Navigate to the **`web`** directory and open **`index.html`** in a browser to access the web app.
3. For mobile versions, navigate to the **`flutter/mosaicizer`** directory and follow Flutter's build instructions for iOS and Android.

## **Contribution:**

Feel free to fork the repository, make changes, and create pull requests. Any contributions to improve the project are welcome!
