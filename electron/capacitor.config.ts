import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
    appId: "com.jonesyj83.truckpilot",
    appName: "TruckPilot",
    webDir: ".output/public",
    server: { androidScheme: "http" },
    plugins: {
        CapacitorHttp: {
            enabled: true,
        },
        Keyboard: {
            resizeOnFullScreen: false,
        },
    },
};

export default config;
