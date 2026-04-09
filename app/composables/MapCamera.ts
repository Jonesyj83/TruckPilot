import { ref, onUnmounted, readonly } from "vue";
import type { Ref } from "vue";
import type { Map } from "maplibre-gl";

const PADDING_NAV = { top: 180, bottom: 0, left: 0, right: 0 };
const PADDING_FREE = { top: 0, bottom: 0, left: 0, right: 0 };
const NAV_ZOOM = 11;
const NAV_PITCH = 38;
const CAMERA_BEARING_FOLLOW_MS = 40;
const MANUAL_INTERACTION_COOLDOWN_MS = 3000;

export const useMapCamera = (map: Ref<Map | null>) => {
    const isCameraLocked = ref(false);
    const isNavigating = ref(false);
    const isManualInteractionCooldownActive = ref(false);

    let targetCoords: [number, number] | null = null;
    let targetHeading: number = 0;

    let previousCoords: [number, number] | null = null;
    let previousHeading: number = 0;
    let lastTargetUpdateTime: number = 0;
    let cameraBearing: number | null = null;
    let lastCameraBearingFrameTime: number | null = null;
    let currentTruckCoords: [number, number] | null = null;
    let currentTruckHeading: number = 0;

    let animationFrameId: number | null = null;
    let isEasing = false;
    let easeTimeout: ReturnType<typeof setTimeout> | null = null;
    let manualInteractionCooldownTimer: ReturnType<typeof setTimeout> | null =
        null;
    let markerEl: HTMLDivElement | null = null;

    const initMarker = (imgSrc: string) => {
        if (!map.value) return;
        if (!markerEl) {
            markerEl = document.createElement("div");
            markerEl.style.position = "absolute";
            markerEl.style.top = "0";
            markerEl.style.left = "0";
            markerEl.style.width = "40px";
            markerEl.style.height = "40px";
            markerEl.style.backgroundImage = `url("${imgSrc}")`;
            markerEl.style.backgroundSize = "contain";
            markerEl.style.backgroundRepeat = "no-repeat";
            markerEl.style.backgroundPosition = "center";
            markerEl.style.pointerEvents = "none";
            markerEl.style.zIndex = "10";
            markerEl.style.willChange = "transform";

            map.value.getContainer().appendChild(markerEl);
        }
    };

    const updateMarkerImage = (imgSrc: string) => {
        if (markerEl) {
            markerEl.style.backgroundImage = `url("${imgSrc}")`;
        }
    };

    const renderLoop = (timestamp: number) => {
        const now = performance.now();

        if (map.value && targetCoords && previousCoords && currentTruckCoords) {
            const elapsed = now - lastTargetUpdateTime;
            const t = Math.min(elapsed / 150, 1);
            const progress = 1 - (1 - t) ** 3;

            currentTruckCoords[0] =
                previousCoords[0] +
                (targetCoords[0] - previousCoords[0]) * progress;
            currentTruckCoords[1] =
                previousCoords[1] +
                (targetCoords[1] - previousCoords[1]) * progress;
            currentTruckHeading =
                previousHeading + (targetHeading - previousHeading) * progress;

            if (cameraBearing === null) {
                cameraBearing = currentTruckHeading;
            } else {
                const frameDeltaMs =
                    lastCameraBearingFrameTime === null
                        ? 16
                        : Math.min(timestamp - lastCameraBearingFrameTime, 50);

                let cameraBearingDiff = currentTruckHeading - cameraBearing;
                while (cameraBearingDiff < -180) cameraBearingDiff += 360;
                while (cameraBearingDiff > 180) cameraBearingDiff -= 360;

                const cameraFollowProgress =
                    1 - Math.exp(-frameDeltaMs / CAMERA_BEARING_FOLLOW_MS);

                cameraBearing += cameraBearingDiff * cameraFollowProgress;
            }

            lastCameraBearingFrameTime = timestamp;
            const isTargetAtOrigin =
                targetCoords[0] === 0 && targetCoords[1] === 0;

            if (isCameraLocked.value && !isTargetAtOrigin) {
                map.value.jumpTo({
                    center: [currentTruckCoords[0], currentTruckCoords[1]],
                    bearing: cameraBearing ?? map.value.getBearing(),
                    zoom: isNavigating.value
                        ? Math.max(map.value.getZoom(), NAV_ZOOM)
                        : map.value.getZoom(),
                    pitch: isNavigating.value
                        ? NAV_PITCH
                        : map.value.getPitch(),
                    padding: isNavigating.value ? PADDING_NAV : PADDING_FREE,
                });
            }

            if (markerEl && !isTargetAtOrigin) {
                const pos = map.value.project(currentTruckCoords);
                const pitch = map.value.getPitch();
                const bearing = map.value.getBearing();

                const screenRot = currentTruckHeading - bearing;

                markerEl.style.transform = `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotateX(${pitch}deg) rotateZ(${screenRot}deg)`;
            }
        }

        animationFrameId = requestAnimationFrame(renderLoop);
    };

    const startRenderLoop = () => {
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(renderLoop);
        }
    };

    const stopRenderLoop = () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    };

    const refreshManualInteractionCooldown = () => {
        isManualInteractionCooldownActive.value = true;

        if (manualInteractionCooldownTimer) {
            clearTimeout(manualInteractionCooldownTimer);
        }

        manualInteractionCooldownTimer = setTimeout(() => {
            isManualInteractionCooldownActive.value = false;
            manualInteractionCooldownTimer = null;
        }, MANUAL_INTERACTION_COOLDOWN_MS);
    };

    const breakLockEvents = [
        "pointerdown",
        "mousedown",
        "touchstart",
        "wheel",
        "pitchstart",
        "boxzoomstart",
    ];

    const initCameraListeners = () => {
        if (!map.value) return;

        startRenderLoop();

        breakLockEvents.forEach((event) => {
            map.value!.on(event, () => {
                if (isEasing) return;
                refreshManualInteractionCooldown();
                if (isCameraLocked.value) isCameraLocked.value = false;
            });
        });
    };

    const followTruck = (coords: [number, number], heading: number) => {
        if (!map.value) return;

        if (currentTruckCoords) {
            previousCoords = [...currentTruckCoords] as [number, number];
            previousHeading = currentTruckHeading;
        } else {
            previousCoords = [...coords] as [number, number];
            previousHeading = heading;
            currentTruckCoords = [...coords] as [number, number];
            currentTruckHeading = heading;
        }

        targetCoords = [...coords] as [number, number];

        let hDiff = heading - previousHeading;
        while (hDiff < -180) hDiff += 360;
        while (hDiff > 180) hDiff -= 360;
        targetHeading = previousHeading + hDiff;

        lastTargetUpdateTime = performance.now();
    };

    const lockCamera = () => {
        if (!map.value) return;
        isCameraLocked.value = true;
    };

    const setNavigationActive = (active: boolean) => {
        isNavigating.value = active;
        if (!active) {
            isCameraLocked.value = false;
        }
    };

    const startNavigationMode = (coords: [number, number], heading: number) => {
        if (!map.value) return;
        isNavigating.value = true;
        isCameraLocked.value = true;
        targetCoords = coords;

        let hDiff = heading - currentTruckHeading;
        while (hDiff < -180) hDiff += 360;
        while (hDiff > 180) hDiff -= 360;
        targetHeading = currentTruckHeading + hDiff;

        isEasing = true;
        if (easeTimeout) clearTimeout(easeTimeout);

        easeTimeout = setTimeout(() => {
            isEasing = false;
        }, 300);

        map.value.easeTo({
            center: coords,
            zoom: NAV_ZOOM,
            pitch: NAV_PITCH,
            duration: 300,
            padding: PADDING_NAV,
        });
    };

    const stopNavigationMode = () => {
        isNavigating.value = false;
        isCameraLocked.value = false;
    };

    onUnmounted(() => {
        stopRenderLoop();
        if (easeTimeout) clearTimeout(easeTimeout);
        if (manualInteractionCooldownTimer) {
            clearTimeout(manualInteractionCooldownTimer);
        }
        if (markerEl) markerEl.remove();
    });

    return {
        isCameraLocked,
        isNavigating,
        isManualInteractionCooldownActive: readonly(
            isManualInteractionCooldownActive,
        ),
        initCameraListeners,
        initMarker,
        updateMarkerImage,
        followTruck,
        lockCamera,
        setNavigationActive,
        startNavigationMode,
        stopNavigationMode,
    };
};
