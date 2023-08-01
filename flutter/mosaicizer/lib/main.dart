import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:gallery_saver/gallery_saver.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:fluttertoast/fluttertoast.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: MyHomePage(),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key});

  @override
  MyHomePageState createState() => MyHomePageState();
}

class MyHomePageState extends State<MyHomePage> {
  late InAppWebViewController _controller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: InAppWebView(
        initialUrlRequest: URLRequest(url: Uri.parse('https://dh031200.github.io/mosaicizer/')),
        onWebViewCreated: (InAppWebViewController controller) {
          _controller = controller;
        },
        onProgressChanged: (InAppWebViewController controller, int progress) {
          if (progress == 100) {
            _controller.addJavaScriptHandler(handlerName: 'fileChooser', callback: (args) {
              _getImage();
            });
            _controller.addJavaScriptHandler(handlerName: 'saveImage', callback: (args) {
              _saveImage(args.first);
            });
            _controller.evaluateJavascript(source: '''
              var saveBtn = document.querySelector('#saveBtn');
              saveBtn.addEventListener('click', function () {
                const resultCanvas = document.getElementById('output');
                const dataUrl = resultCanvas.toDataURL();
                window.flutter_inappwebview.callHandler('saveImage', dataUrl);
              });
            ''');
          }
        },
        onLoadResource: (InAppWebViewController controller, LoadedResource resource) {
          _controller.evaluateJavascript(source: '''
            var meta = document.createElement('meta');
            meta.setAttribute('name', 'viewport');
            meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0');
            document.getElementsByTagName('head')[0].appendChild(meta);
          ''');
        },
      ),
    );
  }

  void _getImage() async {
    final ImagePicker picker = ImagePicker();
    final XFile? imageFile = await picker.pickImage(source: ImageSource.gallery);
    if (imageFile != null) {
      final Uint8List bytes = await imageFile.readAsBytes();
      final String base64 = base64Encode(bytes);
      _controller.evaluateJavascript(source: 'window.uploadFile("$base64")');
    }
  }

  void _saveImage(String dataUrl) async {
    final RegExp regex = RegExp(r'data:image/png;base64,(.+)');
    final Match? match = regex.firstMatch(dataUrl);
    if (match != null && match.groupCount == 1) {
      final String base64 = match.group(1)!;
      final Uint8List bytes = base64Decode(base64);
      final String tempDir = (await getTemporaryDirectory()).path;
      final String filePath = '$tempDir/result.png';
      final File file = File(filePath);
      await file.writeAsBytes(bytes);
      final bool? result = await GallerySaver.saveImage(filePath, albumName: 'Download');
      if (result == true) {
        Fluttertoast.showToast(msg: "Image saved successfully!");
      }
    }
  }
}
