package ph.pocketqr.app;

import android.app.KeyguardManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.hardware.biometrics.BiometricPrompt;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.content.ClipboardManager;
import android.content.ClipData;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "BankingApp")
public class BankingAppPlugin extends Plugin {

    private static final String TAG = "BankingAppPlugin";

    /**
     * Checks which of the specified banking apps are actually installed on this device.
     */
    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        Context context = getContext();
        PackageManager pm = context.getPackageManager();

        JSArray appsInput = call.getArray("apps");
        JSArray installedList = new JSArray();

        if (appsInput == null) {
            call.resolve(new JSObject().put("installedApps", installedList));
            return;
        }

        try {
            for (int i = 0; i < appsInput.length(); i++) {
                JSONObject appObj = appsInput.getJSONObject(i);
                String id = appObj.optString("id");
                String packageName = appObj.optString("androidPackage");
                String scheme = appObj.optString("scheme");

                boolean isInstalled = false;

                // 1. Try checking by package name
                if (packageName != null && !packageName.isEmpty()) {
                    try {
                        pm.getPackageInfo(packageName, 0);
                        isInstalled = true;
                    } catch (PackageManager.NameNotFoundException ignored) {}
                }

                // 2. Fallback: check by custom intent scheme
                if (!isInstalled && scheme != null && !scheme.isEmpty()) {
                    try {
                        Intent testIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(scheme));
                        List<ResolveInfo> resolved = pm.queryIntentActivities(testIntent, 0);
                        if (resolved != null && !resolved.isEmpty()) {
                            isInstalled = true;
                        }
                    } catch (Exception ignored) {}
                }

                if (isInstalled) {
                    installedList.put(id);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking installed apps", e);
        }

        JSObject ret = new JSObject();
        ret.put("installedApps", installedList);
        call.resolve(ret);
    }

    /**
     * Directly launches a native banking app with no browser interference.
     */
    @PluginMethod
    public void launchApp(PluginCall call) {
        Context context = getContext();
        PackageManager pm = context.getPackageManager();

        String packageName = call.getString("androidPackage");
        String scheme = call.getString("scheme");

        Intent launchIntent = null;

        // 1. Attempt launch via custom URI scheme first (e.g. gcash://, maya://)
        if (scheme != null && !scheme.isEmpty()) {
            try {
                Intent schemeIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(scheme));
                if (packageName != null && !packageName.isEmpty()) {
                    schemeIntent.setPackage(packageName);
                }
                schemeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                List<ResolveInfo> activities = pm.queryIntentActivities(schemeIntent, 0);
                if (activities != null && !activities.isEmpty()) {
                    launchIntent = schemeIntent;
                }
            } catch (Exception e) {
                Log.w(TAG, "Scheme launch failed, attempting package launch fallback", e);
            }
        }

        // 2. Fallback to package launcher intent
        if (launchIntent == null && packageName != null && !packageName.isEmpty()) {
            try {
                launchIntent = pm.getLaunchIntentForPackage(packageName);
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                }
            } catch (Exception e) {
                Log.w(TAG, "Package launch fallback failed", e);
            }
        }

        if (launchIntent != null) {
            try {
                context.startActivity(launchIntent);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
                return;
            } catch (Exception e) {
                Log.e(TAG, "Could not start activity", e);
                call.reject("Failed to launch app: " + e.getMessage());
                return;
            }
        }

        call.reject("App is not installed or could not be resolved");
    }

    /**
     * Triggers Android's native Intent.createChooser bottom sheet with installed banking apps.
     */
    @PluginMethod
    public void openNativeChooser(PluginCall call) {
        Context context = getContext();
        PackageManager pm = context.getPackageManager();

        JSArray appsInput = call.getArray("apps");
        if (appsInput == null || appsInput.length() == 0) {
            call.reject("No apps provided");
            return;
        }

        List<Intent> targetedIntents = new ArrayList<>();

        try {
            for (int i = 0; i < appsInput.length(); i++) {
                JSONObject appObj = appsInput.getJSONObject(i);
                String packageName = appObj.optString("androidPackage");
                String scheme = appObj.optString("scheme");

                Intent appIntent = null;
                if (scheme != null && !scheme.isEmpty()) {
                    Intent sIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(scheme));
                    if (packageName != null && !packageName.isEmpty()) {
                        sIntent.setPackage(packageName);
                    }
                    if (!pm.queryIntentActivities(sIntent, 0).isEmpty()) {
                        appIntent = sIntent;
                    }
                }

                if (appIntent == null && packageName != null && !packageName.isEmpty()) {
                    appIntent = pm.getLaunchIntentForPackage(packageName);
                }

                if (appIntent != null) {
                    appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    targetedIntents.add(appIntent);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error building chooser intents", e);
        }

        if (targetedIntents.isEmpty()) {
            call.reject("None of the specified banking apps are installed");
            return;
        }

        Intent primary = targetedIntents.remove(0);
        Intent chooser = Intent.createChooser(primary, "Open with");
        if (!targetedIntents.isEmpty()) {
            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, targetedIntents.toArray(new Intent[0]));
        }
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            context.startActivity(chooser);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to show native chooser", e);
            call.reject("Could not open system chooser: " + e.getMessage());
        }
    }

    /**
     * Purges temporary PocketQR images from the phone's gallery so they don't accumulate.
     */
    public static void cleanupTemporaryQRsStatic(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("pocketqr_gallery_prefs", Context.MODE_PRIVATE);
            String lastUriStr = prefs.getString("last_temp_qr_uri", null);
            ContentResolver resolver = context.getContentResolver();
            if (lastUriStr != null) {
                try {
                    resolver.delete(Uri.parse(lastUriStr), null, null);
                } catch (Exception ignored) {}
                prefs.edit().remove("last_temp_qr_uri").apply();
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                Uri collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                String selection = MediaStore.MediaColumns.RELATIVE_PATH + " LIKE ? AND " + MediaStore.MediaColumns.DISPLAY_NAME + " LIKE ?";
                String[] selectionArgs = new String[]{"Pictures/PocketQR%", "PocketQR_temp_%"};
                resolver.delete(collection, selection, selectionArgs);
            }
        } catch (Exception e) {
            Log.w(TAG, "Cleanup of temporary QRs failed", e);
        }
    }

    /**
     * Cleans up temporary QR images on demand.
     */
    @PluginMethod
    public void cleanupTemporaryQRs(PluginCall call) {
        cleanupTemporaryQRsStatic(getContext());
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    /**
     * Saves a base64 image directly to Android's MediaStore (Pictures/PocketQR)
     * so it immediately appears at the top of the photo gallery / recent photos.
     * Temporary images automatically clean up previous ones and auto-delete after 3 minutes.
     */
    @PluginMethod
    public void saveImageToGallery(PluginCall call) {
        String base64Data = call.getString("base64");
        String fileName = call.getString("fileName");
        boolean isTemporary = call.getBoolean("isTemporary", true);

        Context context = getContext();

        if (isTemporary) {
            // Clean up any existing temporary QR before creating the fresh top photo
            cleanupTemporaryQRsStatic(context);
            if (fileName == null || fileName.isEmpty() || !fileName.startsWith("PocketQR_temp_")) {
                fileName = "PocketQR_temp_" + System.currentTimeMillis() + ".png";
            }
        } else if (fileName == null || fileName.isEmpty()) {
            fileName = "PocketQR_" + System.currentTimeMillis() + ".png";
        }
        if (!fileName.toLowerCase().endsWith(".png") && !fileName.toLowerCase().endsWith(".jpg")) {
            fileName += ".png";
        }
        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("No image data provided");
            return;
        }

        try {
            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }
            byte[] imageBytes = Base64.decode(base64Data, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length);

            if (bitmap == null) {
                call.reject("Failed to decode image from base64");
                return;
            }

            ContentResolver resolver = context.getContentResolver();
            ContentValues contentValues = new ContentValues();
            contentValues.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
            contentValues.put(MediaStore.MediaColumns.MIME_TYPE, "image/png");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                contentValues.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + File.separator + "PocketQR");
                contentValues.put(MediaStore.MediaColumns.IS_PENDING, 1);
            }

            Uri imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues);
            if (imageUri == null) {
                call.reject("Failed to create MediaStore entry");
                return;
            }

            try (OutputStream out = resolver.openOutputStream(imageUri)) {
                if (out != null) {
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
                    out.flush();
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                contentValues.clear();
                contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(imageUri, contentValues, null, null);
            } else {
                MediaScannerConnection.scanFile(context, new String[]{imageUri.getPath()}, new String[]{"image/png"}, null);
            }

            if (isTemporary) {
                SharedPreferences prefs = context.getSharedPreferences("pocketqr_gallery_prefs", Context.MODE_PRIVATE);
                prefs.edit()
                    .putString("last_temp_qr_uri", imageUri.toString())
                    .putLong("last_temp_qr_time", System.currentTimeMillis())
                    .apply();

                // Auto-cleanup after 3 minutes in background
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    cleanupTemporaryQRsStatic(context);
                }, 3 * 60 * 1000);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("uri", imageUri.toString());
            ret.put("isTemporary", isTemporary);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to save image to gallery", e);
            call.reject("Error saving image: " + e.getMessage());
        }
    }

    /**
     * Copies an image and/or text to the Android clipboard.
     */
    @PluginMethod
    public void copyImageToClipboard(PluginCall call) {
        String base64Data = call.getString("base64");
        String text = call.getString("text");

        try {
            Context context = getContext();
            ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);

            if (base64Data != null && !base64Data.isEmpty()) {
                if (base64Data.contains(",")) {
                    base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
                }
                byte[] imageBytes = Base64.decode(base64Data, Base64.DEFAULT);

                File cacheDir = new File(context.getCacheDir(), "images");
                if (!cacheDir.exists()) {
                    cacheDir.mkdirs();
                }
                File imageFile = new File(cacheDir, "clipboard_qr.png");
                try (FileOutputStream fos = new FileOutputStream(imageFile)) {
                    fos.write(imageBytes);
                    fos.flush();
                }

                Uri contentUri = FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        imageFile
                );

                ClipData clip = ClipData.newUri(
                        context.getContentResolver(),
                        "PocketQR Code",
                        contentUri
                );
                if (text != null && !text.isEmpty()) {
                    clip.addItem(new ClipData.Item(text));
                }
                clipboard.setPrimaryClip(clip);
            } else if (text != null && !text.isEmpty()) {
                ClipData clip = ClipData.newPlainText("PocketQR", text);
                clipboard.setPrimaryClip(clip);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to copy to clipboard", e);
            try {
                if (text != null && !text.isEmpty()) {
                    ClipboardManager clipboard = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
                    clipboard.setPrimaryClip(ClipData.newPlainText("PocketQR", text));
                }
            } catch (Exception ignored) {}
            call.resolve(new JSObject().put("success", false).put("error", e.getMessage()));
        }
    }

    /**
     * Native share sheet for QR code image with installed apps.
     */
    @PluginMethod
    public void shareImage(PluginCall call) {
        String base64Data = call.getString("base64");
        String title = call.getString("title");
        String text = call.getString("text");

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("No image provided for sharing");
            return;
        }

        try {
            Context context = getContext();
            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }
            byte[] imageBytes = Base64.decode(base64Data, Base64.DEFAULT);

            File cacheDir = new File(context.getCacheDir(), "images");
            if (!cacheDir.exists()) {
                cacheDir.mkdirs();
            }
            File imageFile = new File(cacheDir, "shared_qr.png");
            try (FileOutputStream fos = new FileOutputStream(imageFile)) {
                fos.write(imageBytes);
                fos.flush();
            }

            Uri contentUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    imageFile
            );

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("image/png");
            shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
            if (text != null && !text.isEmpty()) {
                shareIntent.putExtra(Intent.EXTRA_TEXT, text);
            }
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            shareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            Intent chooser = Intent.createChooser(shareIntent, title != null ? title : "Share QR Code");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to share image", e);
            call.reject("Failed to share image: " + e.getMessage());
        }
    }

    /**
     * Native tactile vibration through Android's Vibrator / VibratorManager service.
     */
    @PluginMethod
    public void vibrate(PluginCall call) {
        int duration = call.getInt("duration", 25);
        Context context = getContext();
        try {
            Vibrator vibrator = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) {
                    vibrator = vm.getDefaultVibrator();
                }
            }
            if (vibrator == null) {
                vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(duration);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Native vibrate failed", e);
        }
        call.resolve();
    }

    /**
     * Native biometric authentication via Android's BiometricPrompt.
     */
    @PluginMethod
    public void authenticateBiometrics(PluginCall call) {
        Context context = getContext();
        KeyguardManager km = (KeyguardManager) context.getSystemService(Context.KEYGUARD_SERVICE);

        if (km == null || !km.isDeviceSecure()) {
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("unsecured", true);
            call.resolve(ret);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getActivity().runOnUiThread(() -> {
                try {
                    CancellationSignal cancellationSignal = new CancellationSignal();
                    BiometricPrompt prompt = new BiometricPrompt.Builder(context)
                            .setTitle("PocketQR Security Interlock")
                            .setSubtitle("Confirm your biometric identity to access vault")
                            .setNegativeButton("Cancel", context.getMainExecutor(), (dialog, which) -> {
                                JSObject ret = new JSObject();
                                ret.put("success", false);
                                ret.put("cancelled", true);
                                call.resolve(ret);
                            })
                            .build();

                    prompt.authenticate(cancellationSignal, context.getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                            JSObject ret = new JSObject();
                            ret.put("success", true);
                            call.resolve(ret);
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, CharSequence errString) {
                            JSObject ret = new JSObject();
                            ret.put("success", false);
                            ret.put("error", errString.toString());
                            call.resolve(ret);
                        }

                        @Override
                        public void onAuthenticationFailed() {
                            // Attempt failed, prompt remains active
                        }
                    });
                } catch (Exception e) {
                    Log.e(TAG, "Native BiometricPrompt failed", e);
                    JSObject ret = new JSObject();
                    ret.put("success", false);
                    ret.put("error", e.getMessage());
                    call.resolve(ret);
                }
            });
        } else {
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        }
    }
}
