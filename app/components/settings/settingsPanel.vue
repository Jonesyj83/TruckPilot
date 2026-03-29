<script lang="ts" setup>
import { ets2Expansions } from "~/data/ets2/ets2Expansions";
import { atsExpansions } from "~/data/ats/atsExpansions";

const { settings, activeSettings, updateProfile } = useSettings();

const props = defineProps<{ closePanel: () => void }>();

const isDlcPanelOpened = ref(false);
const isMetric = computed(() => activeSettings.value.units === "metric");
const isNavBarAtTop = computed(
    () => activeSettings.value.navBarPosition !== "bottom",
);
const navBarSize = computed(() => activeSettings.value.navBarSize);
const routeGuidanceHorizontal = computed(
    () => activeSettings.value.routeGuidanceHorizontal,
);
const routeGuidanceVertical = computed(
    () => activeSettings.value.routeGuidanceVertical,
);
const isRealCompaniesEnabled = computed(
    () =>
        !!activeSettings.value
            .enableRealCompaniesGasStationsBillboardsV40117,
);

const selectedExpansion = computed(() => {
    return settings.value.selectedGame === "ets2"
        ? ets2Expansions
        : atsExpansions;
});

const toggleDlcPanel = () => {
    isDlcPanelOpened.value = !isDlcPanelOpened.value;
};

function toggleUnits() {
    updateProfile("units", isMetric.value ? "imperial" : "metric");
}

function toggleNavBarPosition() {
    updateProfile("navBarPosition", isNavBarAtTop.value ? "bottom" : "top");
}

function setNavBarSize(
    size: "default" | "large" | "xlarge" | "xxlarge",
) {
    updateProfile("navBarSize", size);
}

function setRouteGuidanceHorizontal(value: "left" | "right") {
    updateProfile("routeGuidanceHorizontal", value);
}

function setRouteGuidanceVertical(value: "top" | "middle" | "bottom") {
    updateProfile("routeGuidanceVertical", value);
}

function toggleRealCompaniesSupport() {
    updateProfile(
        "enableRealCompaniesGasStationsBillboardsV40117",
        !isRealCompaniesEnabled.value,
    );
}
</script>

<template>
    <div class="settings-panel">
        <div class="settings-title setting">
            <div class="icon-btn" v-on:click="closePanel">
                <Icon name="material-symbols:close-rounded" size="26" />
            </div>

            <div class="title-icon">
                <Icon name="flowbite:cog-outline" size="38" />

                <div>
                    <p class="panel-title">Settings</p>
                    <p class="panel-description">
                        App preferences and customization
                    </p>
                </div>
            </div>
        </div>

        <div class="separator"></div>

        <ColorOption
            option-title="Theme"
            icon-name="solar:pallete-2-linear"
            color-element="themeColor"
        />

        <ColorOption
            option-title="Route"
            icon-name="material-symbols:route-outline"
            color-element="routeColor"
        />

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:map-plus" size="24" />
                <p>Owned DLCs</p>
            </div>
            <div class="owned-dlcs">
                <button
                    @click.prevent="toggleDlcPanel"
                    class="nav-btn settings-btn default-color"
                >
                    {{ activeSettings.ownedDlcs.length }} /
                    {{ Object.keys(selectedExpansion).length }} active
                </button>
            </div>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:ruler" size="24" />
                <p>Units</p>
            </div>
            <div class="segmented-control" @click="toggleUnits">
                <button class="segment-btn" :class="{ active: isMetric }">
                    <span class="label">Metric</span>
                </button>

                <button class="segment-btn" :class="{ active: !isMetric }">
                    <span class="label">Imperial</span>
                </button>
            </div>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:panel-top" size="24" />
                <p>Nav Bar Position</p>
            </div>
            <div class="segmented-control" @click="toggleNavBarPosition">
                <button class="segment-btn" :class="{ active: isNavBarAtTop }">
                    <span class="label">Top</span>
                </button>

                <button
                    class="segment-btn"
                    :class="{ active: !isNavBarAtTop }"
                >
                    <span class="label">Bottom</span>
                </button>
            </div>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:zoom-in" size="24" />
                <p>Nav Bar Size</p>
            </div>
            <div class="segmented-control segmented-control-4">
                <button
                    class="segment-btn"
                    :class="{ active: navBarSize === 'default' }"
                    @click="setNavBarSize('default')"
                >
                    <span class="label">Default</span>
                </button>
                <button
                    class="segment-btn"
                    :class="{ active: navBarSize === 'large' }"
                    @click="setNavBarSize('large')"
                >
                    <span class="label">Large</span>
                </button>
                <button
                    class="segment-btn"
                    :class="{ active: navBarSize === 'xlarge' }"
                    @click="setNavBarSize('xlarge')"
                >
                    <span class="label">XL</span>
                </button>
                <button
                    class="segment-btn"
                    :class="{ active: navBarSize === 'xxlarge' }"
                    @click="setNavBarSize('xxlarge')"
                >
                    <span class="label">XXL</span>
                </button>
            </div>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:move-horizontal" size="24" />
                <p>Dashboard Side</p>
            </div>
            <div class="segmented-control">
                <button
                    class="segment-btn"
                    :class="{ active: routeGuidanceHorizontal === 'left' }"
                    @click="setRouteGuidanceHorizontal('left')"
                >
                    <span class="label">Left</span>
                </button>
                <button
                    class="segment-btn"
                    :class="{ active: routeGuidanceHorizontal === 'right' }"
                    @click="setRouteGuidanceHorizontal('right')"
                >
                    <span class="label">Right</span>
                </button>
            </div>
        </div>

        <div class="option setting">
            <div class="option-title">
                <Icon name="lucide:move-vertical" size="24" />
                <p>Dashboard Position</p>
            </div>
            <div class="segmented-control segmented-control-3">
                <button
                    class="segment-btn"
                    :class="{ active: routeGuidanceVertical === 'top' }"
                    @click="setRouteGuidanceVertical('top')"
                >
                    <span class="label">Top</span>
                </button>
                <button
                    class="segment-btn"
                    :class="{ active: routeGuidanceVertical === 'middle' }"
                    @click="setRouteGuidanceVertical('middle')"
                >
                    <span class="label">Middle</span>
                </button>
                <button
                    class="segment-btn"
                    :class="{ active: routeGuidanceVertical === 'bottom' }"
                    @click="setRouteGuidanceVertical('bottom')"
                >
                    <span class="label">Bottom</span>
                </button>
            </div>
        </div>

        <div v-if="settings.selectedGame === 'ats'" class="option setting">
            <div class="option-title">
                <Icon name="lucide:building-2" size="24" />
                <p>Enable Real Companies, Gas Stations & Billboards v4.01.17</p>
            </div>
            <div
                class="segmented-control"
                @click="toggleRealCompaniesSupport"
            >
                <button
                    class="segment-btn"
                    :class="{ active: !isRealCompaniesEnabled }"
                >
                    <span class="label">Off</span>
                </button>

                <button
                    class="segment-btn"
                    :class="{ active: isRealCompaniesEnabled }"
                >
                    <span class="label">On</span>
                </button>
            </div>
        </div>

        <Transition name="panel-pop">
            <ManageDlcsWindow
                v-if="isDlcPanelOpened"
                :close-panel="toggleDlcPanel"
            />
        </Transition>
    </div>
</template>

<style
    lang="scss"
    src="~/assets/scss/scoped/settings/settingsPanel.scss"
></style>
