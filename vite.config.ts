import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [vue()],
    build: {
        lib: {
            entry: './components/VueComments.vue',
            name: 'VueComments',
            fileName: (format) => `vue-comments.${format}.js`,
        },
        rollupOptions: {
            external: ['vue'], // Exclude Vue from the bundle
            output: {
                globals: {
                    vue: 'Vue',
                },
            },
        },
    },
});