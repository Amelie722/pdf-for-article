// renderer(화면)에 안전하게 노출하는 함수 모음.
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { Api, Channels } from '../shared/types';

const api: Api = {
  openFileDialog: () => ipcRenderer.invoke(Channels.openFileDialog),
  openPath: (path) => ipcRenderer.invoke(Channels.openPath, path),
  getInitialPath: () => ipcRenderer.invoke(Channels.initialPath),
  onOpenPath: (cb) => {
    ipcRenderer.on(Channels.openPathEvent, (_e, path: string) => cb(path));
  },
  getPathForFile: (file) => webUtils.getPathForFile(file),
  recentDocuments: (limit) => ipcRenderer.invoke(Channels.recent, limit),
  listAnnotations: (docId) => ipcRenderer.invoke(Channels.listAnnotations, docId),
  listAllAnnotations: () => ipcRenderer.invoke(Channels.listAllAnnotations),
  addAnnotation: (a) => ipcRenderer.invoke(Channels.addAnnotation, a),
  updateAnnotation: (id, patch) => ipcRenderer.invoke(Channels.updateAnnotation, id, patch),
  deleteAnnotation: (id) => ipcRenderer.invoke(Channels.deleteAnnotation, id),
};

contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('menu', {
  onCommand: (cb: (cmd: string) => void) => ipcRenderer.on('menu:command', (_e, cmd: string) => cb(cmd)),
});
