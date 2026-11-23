import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base:'./',server:{host:'127.0.0.1',port:5173,watch:{ignored:['**/output/**','**/test-results/**']},proxy:{'/api':{target:'http://127.0.0.1:8787'}}},preview:{proxy:{'/api':{target:'http://127.0.0.1:8787'}}},build:{chunkSizeWarningLimit:800,rollupOptions:{output:{manualChunks(id){if(id.includes('node_modules'))return /@xyflow|d3-/.test(id)?'graph-vendor':'vendor'}}}}});
