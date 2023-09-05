import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:image_picker/image_picker.dart';
import 'package:package_info/package_info.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:image_gallery_saver/image_gallery_saver.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:fluttertoast/fluttertoast.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:store_redirect/store_redirect.dart';
import 'package:app_tracking_transparency/app_tracking_transparency.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import 'firebase_options.dart';


const Map<String, String> unitID = kReleaseMode
    ? {
        'ios': 'ca-app-pub-1117721907680627/7461167636',
        'android': 'ca-app-pub-1117721907680627/1986116731',
      }
    : {
        'ios': 'ca-app-pub-3940256099942544/2934735716',
        'android': 'ca-app-pub-3940256099942544/6300978111',
      };

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  MobileAds.instance.initialize();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  static FirebaseAnalytics analytics = FirebaseAnalytics.instance;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: MyHomePage(),
      navigatorObservers: [
        FirebaseAnalyticsObserver(analytics: analytics),
      ],
    );
  }
}

class MyHomePage extends StatelessWidget {
  final ValueNotifier<String> authStatus = ValueNotifier<String>('Unknown');

  MyHomePage({super.key}){
    initPlugin();
  }

  @override
  Widget build(BuildContext context) {
    bool isEventListenersRemoved = false;
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
      backgroundColor:
          MediaQuery.of(context).platformBrightness == Brightness.dark
              ? const Color(0xff2d2d2d)
              : const Color(0xffd9d9d9),
      body: SafeArea(
          child: Column(
        children: [
          SizedBox(
            height: 60,
            child: AdWidget(
              ad: banner,
            ),
          ),
          Expanded(
            child: InAppWebView(
              initialUrlRequest:
                  URLRequest(url: Uri.parse('https://mosaicizer.com/')),
              onProgressChanged:
                  (InAppWebViewController controller, int progress) async {
                if (progress == 100 && !isEventListenersRemoved) {
                  PackageInfo packageInfo = await PackageInfo.fromPlatform();
                  String buildNumber = packageInfo.buildNumber;
                  controller.evaluateJavascript(source: '''
                  App.isMobile = true;
                  document.getElementById("appVersion").value = "$buildNumber";
                ''');
                  isEventListenersRemoved = true;
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
                    App.saveBtnElement.addEventListener("click", async function () {
                      await handleSaveBtnClick();
                      setTimeout(async function () {
                        window.flutter_inappwebview.callHandler("saveImage", App.downloadLink);
                        hideLoadingOverlay();
                      }, 100);
                    });
                    App.updateBtn.addEventListener('click', function() {
                      window.flutter_inappwebview.callHandler('updateApp');
                    });
                    App.exitBtn.addEventListener("click", function() {
                      window.flutter_inappwebview.callHandler("exitApp");
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
    PermissionStatus result;
    if (Platform.isAndroid) {
      DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();
      AndroidDeviceInfo androidInfo = await deviceInfo.androidInfo;
      if (androidInfo.version.sdkInt >= 33) {
        result = await Permission.photos.request();
      } else {
        result = await Permission.storage.request();
      }
      if (!result.isGranted) {
        await openAppSettings();
      }
    }
    final RegExp regex = RegExp(r'data:image/png;base64,(.+)');
    final Match? match = regex.firstMatch(dataUrl);
    if (match != null && match.groupCount == 1) {
      final String base64 = match.group(1)!;
      final Uint8List bytes = base64Decode(base64);
      final result = await ImageGallerySaver.saveImage(bytes,
          name: 'mosaicizer_result', quality: 100);
      if (result['isSuccess']) {
        Fluttertoast.showToast(msg: "Image saved successfully!");
      } else {
        Fluttertoast.showToast(msg: "Failed to save image!");
      }
    }
  }

  Future<void> initPlugin() async {
    final TrackingStatus status = await AppTrackingTransparency.trackingAuthorizationStatus;
    authStatus.value = '$status';
    if (status == TrackingStatus.notDetermined){
      final TrackingStatus status = await AppTrackingTransparency.requestTrackingAuthorization();
      authStatus.value = '$status';
    }
  }
}
