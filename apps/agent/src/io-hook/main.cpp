
#include <napi.h>
#include <thread>

#ifdef _WIN32
    #include <windows.h>
    HHOOK hKeyboardHook;
    HHOOK hMouseHook;
#elif __APPLE__
    #include <ApplicationServices/ApplicationServices.h>
    CFMachPortRef eventTap;
#elif __linux__
    #include <fcntl.h>
    #include <linux/input.h>
    #include <unistd.h>
    int fd = -1;
#endif

// Global ThreadSafeFunction for async event emission
Napi::ThreadSafeFunction tsfn;

// Emit event function (cross-platform)
void EmitEvent(std::string eventType, int keycode) {
    tsfn.BlockingCall([eventType, keycode](Napi::Env env, Napi::Function callback) {
        callback.Call({Napi::String::New(env, eventType), Napi::Number::New(env, keycode)});
    });
}

#ifdef _WIN32
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
}

void StopWindowsHooks() {
    UnhookWindowsHookEx(hKeyboardHook);
    UnhookWindowsHookEx(hMouseHook);
}
#endif

#ifdef __APPLE__
CGEventRef eventCallback(CGEventTapProxy proxy, CGEventType type, CGEventRef event, void *refcon) {
    EmitEvent((type >= kCGEventMouseMoved) ? "mouse" : "key", type);
    return event;
}

void StartMacHooks() {
    eventTap = CGEventTapCreate(kCGSessionEventTap, kCGHeadInsertEventTap, kCGEventTapOptionDefault, kCGEventMaskForAllEvents, eventCallback, NULL);
    CFRunLoopSourceRef runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0);
    CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, kCFRunLoopCommonModes);
    CGEventTapEnable(eventTap, true);
    CFRunLoopRun();
}

void StopMacHooks() {
    if (eventTap) {
        CGEventTapEnable(eventTap, false);
        CFRelease(eventTap);
    }
}
#endif

#ifdef __linux__
void StartLinuxHooks() {
    fd = open("/dev/input/event2", O_RDONLY);
    if (fd == -1) return;

    struct input_event ev;
    while (read(fd, &ev, sizeof(ev)) > 0) {
        if (ev.type == EV_KEY)
            EmitEvent("key", ev.code);
        else if (ev.type == EV_REL || ev.type == EV_ABS)
            EmitEvent("mouse", ev.code);
    }
}

void StopLinuxHooks() {
    if (fd >= 0) {
        close(fd);
        fd = -1;
    }
}
#endif

Napi::Value StartTracking(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    tsfn = Napi::ThreadSafeFunction::New(env, info[0].As<Napi::Function>(), "Tracking", 0, 1);

    #ifdef _WIN32
        StartWindowsHooks();
    #elif __APPLE__
        std::thread(StartMacHooks).detach();
    #elif __linux__
        std::thread(StartLinuxHooks).detach();
    #endif

    return Napi::String::New(env, "Tracking Started!");
}

Napi::Value StopTracking(const Napi::CallbackInfo& info) {
    #ifdef _WIN32
        StopWindowsHooks();
    #elif __APPLE__
        StopMacHooks();
    #elif __linux__
        StopLinuxHooks();
    #endif
    return Napi::String::New(info.Env(), "Tracking Stopped!");
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("startTracking", Napi::Function::New(env, StartTracking));
    exports.Set("stopTracking", Napi::Function::New(env, StopTracking));
    return exports;
}
NODE_API_MODULE(keyboard_mouse_tracker, Init)
