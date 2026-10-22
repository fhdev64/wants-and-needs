import java.util.Properties

// VK ID app id (and optionally its secret) for signing in through the VK app: android/local.properties
// (vkClientId=..., vkClientSecret=...) or -P on the command line. Without it the app signs in to VK via the browser.
val localProps = Properties().apply { rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) } }
fun prop(name: String) = ((project.findProperty(name) as String?) ?: localProps.getProperty(name) ?: "").trim()
val vkClientId = prop("vkClientId").takeIf { it.matches(Regex("\\d+")) } ?: ""

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "app.hotelki.hotelki"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "app.hotelki.hotelki"
        // test builds install next to the real app: --android-project-arg=idSuffix=.test
        (project.findProperty("idSuffix") as String?)?.let { applicationIdSuffix = it }
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        // the SDK insists on all four; "0" stands for "not configured" and MainActivity then never calls the SDK
        manifestPlaceholders += mapOf(
            "VKIDClientID" to vkClientId.ifEmpty { "0" },
            // used by the SDK for its statistics only: the code is swapped for a token on our server
            "VKIDClientSecret" to prop("vkClientSecret").ifEmpty { "-" },
            "VKIDRedirectHost" to "vk.ru",
            "VKIDRedirectScheme" to "vk${vkClientId.ifEmpty { "0" }}",
        )
        buildConfigField("String", "VK_CLIENT_ID", "\"$vkClientId\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
            // R8 strips methods the plugins call via reflection (shared_preferences crashed on start)
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
    implementation("com.vk.id:vkid:2.7.3")
}
