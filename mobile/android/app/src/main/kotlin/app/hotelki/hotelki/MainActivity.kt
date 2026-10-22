package app.hotelki.hotelki

import android.annotation.SuppressLint
import android.content.Intent
import android.provider.Settings
import com.vk.id.AccessToken
import com.vk.id.VKID
import com.vk.id.VKIDAuthFail
import com.vk.id.auth.AuthCodeData
import com.vk.id.auth.VKIDAuthCallback
import com.vk.id.auth.VKIDAuthParams
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // the id a sign-in tag is bound to: stays the same after reinstalling the app, differs on every other device
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "hotelkino/device").setMethodCallHandler { call, result ->
            if (call.method == "id") result.success(androidId()) else result.notImplemented()
        }
        // Sign-in through the installed VK app. The SDK gets an authorization code made with the server's
        // code_challenge; the server swaps it for the profile. Any error here sends the app to the browser sign-in.
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "hotelkino/vkid").setMethodCallHandler { call, result ->
            when (call.method) {
                // the VK app id this build was made for, or null when the VK app can't be used
                "clientId" -> result.success(if (App.vkReady && vkAppInstalled()) BuildConfig.VK_CLIENT_ID else null)
                "login" -> login(call.argument<String>("state")!!, call.argument<String>("challenge")!!, result)
                else -> result.notImplemented()
            }
        }
    }

    @SuppressLint("HardwareIds")
    private fun androidId(): String? = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)

    // VK, OK and Mail.ru apps answer this action when they can confirm a VK ID sign-in
    private fun vkAppInstalled() = packageManager.queryIntentServices(Intent("com.vk.silentauth.action.GET_INFO"), 0).isNotEmpty()

    private fun login(state: String, challenge: String, result: MethodChannel.Result) {
        var answered = false
        fun reply(f: () -> Unit) { if (!answered) { answered = true; f() } }
        val callback = object : VKIDAuthCallback {
            override fun onAuthCode(data: AuthCodeData, isCompletion: Boolean) =
                reply { result.success(mapOf("code" to data.code, "deviceId" to data.deviceId)) }

            // never comes with our own code_challenge: the SDK has no verifier to fetch the token itself
            override fun onAuth(accessToken: AccessToken) = reply { result.error("failed", "unexpected token", null) }

            override fun onFail(fail: VKIDAuthFail) = reply {
                result.error(if (fail is VKIDAuthFail.Canceled) "cancelled" else "failed", fail.description, null)
            }
        }
        try {
            VKID.instance.authorize(this, callback, VKIDAuthParams {
                this.state = state
                codeChallenge = challenge
                scopes = setOf("email")
            })
        } catch (e: Exception) {
            reply { result.error("failed", e.message, null) }
        }
    }
}
