package ph.pocketqr.app;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BankingAppPlugin.class);
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() != null && getBridge().getWebView() != null && getBridge().getWebView().canGoBack()) {
                    getBridge().getWebView().goBack();
                } else {
                    moveTaskToBack(true);
                }
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        try {
            android.content.SharedPreferences prefs = getSharedPreferences("pocketqr_gallery_prefs", MODE_PRIVATE);
            long lastTime = prefs.getLong("last_temp_qr_time", 0);
            if (lastTime > 0 && (System.currentTimeMillis() - lastTime) > 2 * 60 * 1000) {
                BankingAppPlugin.cleanupTemporaryQRsStatic(this);
            }
        } catch (Exception ignored) {}
    }
}
