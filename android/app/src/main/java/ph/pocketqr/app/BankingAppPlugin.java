package ph.pocketqr.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

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
}
