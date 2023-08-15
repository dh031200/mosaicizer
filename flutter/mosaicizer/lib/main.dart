import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:gallery_saver/gallery_saver.dart';
import 'package:image_picker/image_picker.dart';
import 'package:package_info/package_info.dart';
import 'package:path_provider/path_provider.dart';
import 'package:fluttertoast/fluttertoast.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:store_redirect/store_redirect.dart';

const Map<String, String> unitID = kReleaseMode
    ? {
        'ios': 'ca-app-pub-1117721907680627/1986116731',
        'android': 'ca-app-pub-1117721907680627/1986116731',
      }
    : {
        'ios': 'ca-app-pub-3940256099942544/2934735716',
        'android': 'ca-app-pub-3940256099942544/6300978111',
      };

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  MobileAds.instance.initialize();

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

class MyHomePage extends StatelessWidget {
  const MyHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.light);
    TargetPlatform os = Theme.of(context).platform;
    BannerAd banner = BannerAd(
      listener: BannerAdListener(
        onAdFailedToLoad: (Ad ad, LoadAdError error) {
          if (kDebugMode) {
            print("Failed to load ad: $error");
          }
        },
        onAdLoaded: (_) {
          if (kDebugMode) {
            print("Ad loaded successfully.");
          }
        },
      ),
      size: AdSize.banner,
      adUnitId: unitID[os == TargetPlatform.iOS ? 'ios' : 'android']!,
      request: const AdRequest(),
    )..load();

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
          child: Column(
        children: [
          SizedBox(
            // color: Colors.black,
            height: 60,
            child: AdWidget(
              ad: banner,
            ),
          ),
          Expanded(
            child: InAppWebView(
              initialUrlRequest:
                  URLRequest(url: Uri.parse('https://mosaicizer.com/')),
              onWebViewCreated: (InAppWebViewController controller) async {
                PackageInfo packageInfo = await PackageInfo.fromPlatform();
                String buildNumber = packageInfo.buildNumber;
                controller.evaluateJavascript(source: '''
                  document.getElementById("appVersion").value = "$buildNumber";
                ''');
              },
              onProgressChanged:
                  (InAppWebViewController controller, int progress) {
                if (progress == 100) {
                  controller.addJavaScriptHandler(
                      handlerName: 'exitApp',
                      callback: (args) {
                        SystemNavigator.pop();
                      });
                  controller.addJavaScriptHandler(
                      handlerName: 'updateApp',
                      callback: (args) {
                        StoreRedirect.redirect(
                            androidAppId: 'com.twodevteam.mosaicizer',
                            iOSAppId: 'idxxx');
                      });
                  controller.addJavaScriptHandler(
                      handlerName: 'fileChooser',
                      callback: (args) {
                        _getImage(controller);
                      });
                  controller.addJavaScriptHandler(
                      handlerName: 'saveImage',
                      callback: (args) {
                        _saveImage(args.first);
                      });
                  controller.evaluateJavascript(source: '''
              const saveBtn = document.querySelector('#saveBtn');
              saveBtn.addEventListener('click', function () {
                handleSaveBtnClick(true);
                setTimeout(async function () {
                  const resultCanvas = document.getElementById('output');                 
                  const dataUrl = resultCanvas.toDataURL();
                  window.flutter_inappwebview.callHandler('saveImage', dataUrl);
                }, 50);
              });
              document.querySelector('#updateBtn').addEventListener('click', function() {
                window.flutter_inappwebview.callHandler('updateApp');
              });
              document.querySelector('#exitBtn').addEventListener('click', function() {
                window.flutter_inappwebview.callHandler('exitApp');
              });
            ''');
                }
              },
              onLoadResource:
                  (InAppWebViewController controller, LoadedResource resource) {
                controller.evaluateJavascript(source: '''
            var meta = document.createElement('meta');
            meta.setAttribute('name', 'viewport');
            meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0');
            document.getElementsByTagName('head')[0].appendChild(meta);
          ''');
              },
            ),
          )
        ],
      )),
    );
  }

  void _getImage(InAppWebViewController controller) async {
    final ImagePicker picker = ImagePicker();
    final XFile? imageFile =
        await picker.pickImage(source: ImageSource.gallery);
    if (imageFile != null) {
      final Uint8List bytes = await imageFile.readAsBytes();
      final String base64 = base64Encode(bytes);
      controller.evaluateJavascript(source: 'window.uploadFile("$base64")');
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
      final bool? result =
          await GallerySaver.saveImage(filePath, albumName: 'Download');
      if (result == true) {
        Fluttertoast.showToast(msg: "Image saved successfully!");
      } else {
        Fluttertoast.showToast(msg: "Failed to save image!");
      }
    }
  }
}
