package app.hotelki.hotelki

import android.app.Application
import com.vk.id.VKID

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        // the VK ID SDK must be ready before its activities come back after the process was killed
        if (BuildConfig.VK_CLIENT_ID.isNotEmpty()) runCatching { VKID.init(this) }.onSuccess { vkReady = true }
    }

    companion object {
        var vkReady = false
    }
}
