<script lang="ts" setup>
import { DEFAULT_TELEMETRY_ENDPOINT } from "~/composables/Settings";

const props = defineProps<{ launchChooseGame: () => void }>();

const { fetchIp, fetchPort, localIP, localPort } = useNetwork();
const { updateGlobal } = useSettings();

const isServerRunning = ref(false);
const polling = ref<any>(null);
const isWindowOpened = ref(false);

const checkStatus = async () => {
    const processExists = await (window as any).electronAPI.checkServerStatus();

    if (processExists) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            const response = await fetch(DEFAULT_TELEMETRY_ENDPOINT, {
                signal: controller.signal,
                cache: "no-cache",
            });
            clearTimeout(timeoutId);
            isServerRunning.value = response.ok;
        } catch {
            isServerRunning.value = false;
        }
    } else {
        isServerRunning.value = false;
    }
};

const handleLocalLaunch = async () => {
    updateGlobal("telemetryEndpoint", DEFAULT_TELEMETRY_ENDPOINT);
    props.launchChooseGame();
};

onMounted(async () => {
    await fetchIp();
    await fetchPort();

    (window as any).electronAPI.setWindowSize(900, 600, false, false);

    checkStatus();

    const bootTimer = setInterval(async () => {
        if (isServerRunning.value) {
            clearInterval(bootTimer);
            startRegularPolling();
            return;
        }

        await checkStatus();
    }, 500);
});

onUnmounted(() => {
    if (polling.value) clearInterval(polling.value);
});

const startRegularPolling = () => {
    polling.value = setInterval(async () => {
        await checkStatus();
    }, 5000);
};

const openLink = async (url: string) => {
    (window as any).electronAPI.openExternal(url);
};

const toggleWindow = () => {
    isWindowOpened.value = !isWindowOpened.value;
};
</script>

<template>
    <section class="section-device-info">
        <div class="top-tagline">
            <Icon name="whh:gpsalt" class="icon" size="20" />
            <span>Your Trucking Companion</span>
        </div>

        <div class="content">
            <h2 class="title">Welcome to TruckPilot!</h2>
            <span class="subtitle"
                >Below you’ll find instructions to set up the app on your
                phone.</span
            >
            <div class="steps">
                <ol>
                    <li>Make sure ETS2 / ATS is running on your PC.</li>
                    <li>
                        Have TruckSim GPS Telemetry Server from <br>
                        <a href="https://github.com/Jonesyj83/trucksim-gps-server" target="_blank">
                        https://github.com/Jonesyj83/trucksim-gps-server</a> running
                    </li>
                    <li><!--
                        Open the TruckPilot app or web browser using the ip
                        address below.
                    </li>
                    <li>
                        TruckPilot App:
                        <strong class="localIp">{{ localIP }}</strong> | -->
                        Browser:
                        <strong class="localIp"
                            >{{ localIP }}:{{ localPort }}</strong
                        >
                    </li>
                </ol>
            </div>

            <div class="bottom-info">
                <div class="status-div">
                    <div class="status">
                        <p>Current Status: &nbsp;</p>
                        <span
                            :class="
                                isServerRunning ? 'connected' : 'disconnected'
                            "
                            >{{
                                isServerRunning
                                    ? "Connected"
                                    : "Offline - try opening again."
                            }}</span
                        >
                    </div>
<!--
                    <div
                        v-if="isServerRunning"
                        class="status-indicator is-safe"
                    >
                        <Icon
                            name="mdi:check-circle-outline"
                            size="20"
                            class="icon"
                        />
                       <span
                            >Safe to close this window if connecting from
                            TruckPilot app!</span
                        > 
                    </div>
-->
                    <div
                        v-if="isServerRunning"
                        class="status-indicator is-not-safe"
                    >
                        <Icon
                            name="mdi:close-circle-outline"
                            size="20"
                            class="icon"
                        />
                        <span
                            >Keep this window open if connecting from web
                            browser!</span
                        >
                    </div>
                </div>
            </div>
        </div>

        <div class="bottom">
            <div class="github-link">
                <Icon name="mdi:github" size="20" />
                <span>
                    GitHub Link:
                    <a
                        @click.prevent="
                            openLink(
                                'https://github.com/Jonesyj83/TruckPilot',
                            )
                        "
                        >TruckPilot</a
                    >
                </span>
            </div>

            <Transition name="panel-pop">
                <div
                    @click.self="toggleWindow"
                    v-show="isWindowOpened"
                    class="connect-modal-overlay"
                >
                    <div class="connect-window">
                        <InputComputerIP @connected="launchChooseGame" />
                    </div>
                </div>
            </Transition>

            <div class="connection-type">
               <!-- <button @click.prevent="toggleWindow" class="btn">
                    <span>Remote GPS</span>
                    <Icon name="material-symbols:link-rounded" size="20" />
                </button> -->

                <button @click.prevent="handleLocalLaunch" class="btn">
                    <span>Open GPS </span>
                    <Icon
                        name="material-symbols:screenshot-monitor-outline-rounded"
                        size="20"
                    />
                </button>
            </div>
        </div>
    </section>
</template>

<style
    scoped
    lang="scss"
    src="~/assets/scss/scoped/layouts/desktopIndex.scss"
></style>
