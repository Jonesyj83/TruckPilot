// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: "2026-03-29",
    devtools: { enabled: false },
    ssr: false,
    modules: ["@nuxt/icon", "@nuxt/ui"],

    css: ["~/assets/css/main.css", "~/assets/scss/global/_transitions.scss"],

    vite: {
        optimizeDeps: {
            include: [
                "@capacitor-community/keep-awake",
                "@capacitor-community/safe-area",
                "@capacitor/core",
		        'rbush',
				'maplibre-gl', // CJS
				'pmtiles',
				'@turf/turf',
				'proj4',
            ],
        },
        css: {
            preprocessorOptions: {
                scss: {
                    additionalData: `@use "~/assets/scss/global/variables.scss" as *;
@use "~/assets/scss/global/_mixins.scss" as *;`,
                },
            },
        },
    },

    app: {
        head: {
            title: "TruckPilot",
            meta: [
                {
                    name: "viewport",
                    content:
                        "width=device-width, initial-scale=1, viewport-fit=cover",
                },
            ],
        },
    },

    components: [{ path: "~/components", pathPrefix: false }],
});
