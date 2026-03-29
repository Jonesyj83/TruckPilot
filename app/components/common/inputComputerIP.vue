<script lang="ts" setup>
import { CapacitorHttp } from "@capacitor/core";
import { DEFAULT_TELEMETRY_ENDPOINT } from "~/composables/Settings";

const props = defineProps<{ requireGame?: boolean }>();

const { isWeb } = usePlatform();
const { selectedGame, commitSelection } = useGameSelection();
const { settings, updateGlobal } = useSettings();

const connectionError = ref("Disconnected");
const ipInput = ref("");
const isConnecting = ref(false);
const isConnected = ref(false);

const emit = defineEmits(["connected"]);

watch(isConnected, (connected) => {
    if (connected) {
        emit("connected");
    }
});

watch(
    () => settings.value.telemetryEndpoint,
    (newEndpoint) => {
        if (newEndpoint && !ipInput.value) {
            ipInput.value = newEndpoint;
        }
    },
);

function normalizeTelemetryEndpoint(input: string) {
    const trimmed = input.trim();
    if (!trimmed) return DEFAULT_TELEMETRY_ENDPOINT;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `http://${trimmed}:31377/api/ets2/telemetry`;
}

const canConnect = computed(() => {
    if (isConnecting.value) return false;
    if (props.requireGame) return !!selectedGame.value;
    return true;
});

const handleConnect = async () => {
    connectionError.value = "Disconnected";

    if (!ipInput.value) {
        connectionError.value = "Please input a value.";
        return;
    }

    isConnecting.value = true;

    try {
        const endpoint = normalizeTelemetryEndpoint(ipInput.value);
        let data;

        if (!isWeb.value) {
            const options = {
                url: endpoint,
                connectTimeout: 2000,
                readTimeout: 2000,
            };

            const response = await CapacitorHttp.get(options);
            data = response.data;
        } else {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const response = await fetch(endpoint, {
                signal: controller.signal,
                cache: "no-cache",
            });
            clearTimeout(timeoutId);
            data = response.ok ? await response.json() : null;
        }

        if (data) {
            updateGlobal("telemetryEndpoint", endpoint);

            isConnected.value = true;
            commitSelection();

            setTimeout(() => {
                isConnecting.value = false;
                emit("connected");
            }, 500);
        } else {
            throw new Error("Server reached but returned invalid data");
        }
    } catch (error) {
        isConnected.value = false;
        console.error("Connection failed:", error);
        connectionError.value =
            "Could not connect to TruckPilot. Is the server running and on the same Wi-Fi?";
        isConnecting.value = false;
    }
};
</script>

<template>
    <div class="connect-pc-module">
        <div class="input-ip">
            <div class="form-details">
                <form @submit.prevent="handleConnect" action="">
                    <label for="ip">Telemetry Endpoint:</label>
                    <input
                        id="ip"
                        v-model="ipInput"
                        type="text"
                        name="ip"
                        placeholder="http://127.0.0.1:31377/api/ets2/telemetry"
                        :disabled="isConnecting"
                    />
                </form>
                <p class="status">
                    <span v-if="!connectionError">Current Status: &nbsp;</span>
                    <span :class="isConnected ? 'connected' : 'disconnected'">{{
                        isConnected ? "Connected" : connectionError
                    }}</span>
                </p>
            </div>

            <div class="description">
                <div class="note">
                    <Icon name="i-majesticons:information-circle-line" />
                    <p>Note</p>
                </div>
                <p class="description-text">
                    Enter the full telemetry URL or just the host/IP
                </p>
            </div>
        </div>

        <button class="btn" @click="handleConnect" :disabled="!canConnect">
            <span>{{ isConnecting ? "Connecting..." : "Connect" }}</span>
            <Icon name="i-fa7-solid:chain" size="20" />
        </button>
    </div>
</template>

<style
    lang="scss"
    scoped
    src="~/assets/scss/scoped/common/inputComputerIP.scss"
></style>
