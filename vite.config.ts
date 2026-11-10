import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { downloadProxy } from './server/download-proxy.mjs';
export default defineConfig({base:'./',build:{rollupOptions:{output:{manualChunks(id){
 if(id.includes('vite/preload-helper'))return 'preload';
 if(id.includes('/node_modules/@mlightcad/')||id.includes('/node_modules/three/')||id.includes('/node_modules/lodash-es/')) return 'cad-engine';
}}}},plugins:[{name:'streambim-download',configureServer(server){server.middlewares.use(downloadProxy);},configurePreviewServer(server){server.middlewares.use(downloadProxy);}},viteStaticCopy({targets:[
 {src:'node_modules/@mlightcad/cad-simple-viewer/dist/mtext-renderer-worker.js',dest:'assets',rename:{stripBase:true}},
 {src:'node_modules/@mlightcad/libredwg-converter/dist/libredwg-parser-worker.js',dest:'assets',rename:{stripBase:true}},
 {src:'node_modules/@mlightcad/libredwg-converter/dist/libredwg-web.wasm',dest:'assets',rename:{stripBase:true}}
]})]});
