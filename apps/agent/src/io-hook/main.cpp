
#include <napi.h>
#include <thread> // ✅ Added for std::thread

#ifdef _WIN32
    #include <windows.h>
    HHOOK hKeyboardHook;
    HHOOK hMouseHook;
#elif __APPLE__
    #include <ApplicationServices/ApplicationServices.h>
#elif __linux__
    #include <fcntl.h>
    #include <linux/input.h>
    #include <unistd.h>
    #include <dirent.h>
#endif

Napi::ThreadSafeFunction tsfn;  // ✅ Correctly store the callback

// **Emit event to JavaScript (Cross-Platform)**
void EmitEvent(std::string eventType, int keycode) {
    tsfn.BlockingCall([eventType, keycode](Napi::Env env, Napi::Function jsCallback) {
        jsCallback.Call({Napi::String::New(env, eventType), Napi::Number::New(env, keycode)});
    });
}

#ifdef _WIN32
// **Windows Hook Procedure**
LRESULT CALLBACK KeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode >= 0) EmitEvent("key", wParam);
    return CallNextHookEx(hKeyboardHook, nCode, wParam, lParam);
}

LRESULT CALLBACK MouseProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode >= 0) EmitEvent("mouse", wParam);
    return CallNextHookEx(hMouseHook, nCode, wParam, lParam);
}

void StartWindowsHooks() {
    hKeyboardHook = SetWindowsHookEx(WH_KEYBOARD_LL, KeyboardProc, NULL, 0);
    hMouseHook = SetWindowsHookEx(WH_MOUSE_LL, MouseProc, NULL, 0);
    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
}
#endif

#ifdef __APPLE__
// **MacOS Key & Mouse Hook using CGEventTap**
CGEventRef eventCallback(CGEventTapProxy proxy, CGEventType type, CGEventRef event, void *refcon) {
    EmitEvent((type >= kCGEventMouseMoved) ? "mouse" : "key", type);
    return event;
}

void StartMacHooks() {
    CFMachPortRef eventTap = CGEventTapCreate(kCGSessionEventTap, kCGHeadInsertEventTap, kCGEventTapOptionDefault, kCGEventMaskForAllEvents, eventCallback, NULL);
    if (!eventTap) return;

    CFRunLoopSourceRef runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0);
    CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, kCFRunLoopCommonModes);
    CGEventTapEnable(eventTap, true);
    CFRunLoopRun();
}
#endif

#ifdef __linux__
// **Find and Open a Valid Input Device**
std::string GetInputDevice() {
    DIR* dir = opendir("/dev/input");
    if (!dir) return "/dev/input/event0";

    struct dirent* entry;
    while ((entry = readdir(dir)) != NULL) {
        if (strncmp(entry->d_name, "event", 5) == 0) {
            std::string devicePath = "/dev/input/";
            devicePath += entry->d_name;
            closedir(dir);
            return devicePath;
        }
    }
    closedir(dir);
    return "/dev/input/event0";
}

// **Linux Key & Mouse Hook using `evdev`**
void StartLinuxHooks() {
    std::string device = GetInputDevice();
    int fd = open(device.c_str(), O_RDONLY);
    if (fd == -1) return;

    struct input_event ev;
    while (read(fd, &ev, sizeof(ev)) > 0) {
        if (ev.type == EV_KEY)
            EmitEvent("key", ev.code);
        else if (ev.type == EV_REL || ev.type == EV_ABS)
            EmitEvent("mouse", ev.code);
    }
    close(fd);
}
#endif

// **Node.js Exported Function**
Napi::Value StartTracking(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env(); // ✅ Correct: use function scope for env

    if (!info[0].IsFunction()) {
        Napi::TypeError::New(env, "Callback function required").ThrowAsJavaScriptException();
        return env.Null();
    }

    tsfn = Napi::ThreadSafeFunction::New(env, info[0].As<Napi::Function>(), "TrackingCallback", 0, 1);

    #ifdef _WIN32
        std::thread(StartWindowsHooks).detach();
    #elif __APPLE__
        std::thread(StartMacHooks).detach();
    #elif __linux__
        std::thread(StartLinuxHooks).detach();
    #endif

    return Napi::String::New(env, "Tracking Started!");
}

// **Module Export**
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "startTracking"), Napi::Function::New(env, StartTracking));
    return exports;
}

NODE_API_MODULE(keyboard_mouse_tracker, Init)
