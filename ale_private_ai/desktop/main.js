const {app,BrowserWindow,globalShortcut} = require('electron');
const path=require('path');

let localServer=null;
let mainWindow=null;

async function createWindow(){
  const {startServer}=await import(path.join(__dirname,'../server.mjs'));
  const started=await startServer({host:'127.0.0.1',port:0,log:false});
  localServer=started.server;
  const win=new BrowserWindow({
    width:900,height:780,
    transparent:true,
    frame:false,
    alwaysOnTop:true,
    resizable:true,
    hasShadow:false,
    webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}
  });
  mainWindow=win;
  win.setAlwaysOnTop(true,'floating');
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{
    if(!url.startsWith(started.url))event.preventDefault();
  });
  await win.loadURL(started.url);
  // Ctrl/Cmd+Shift+A toggles visibility.
  globalShortcut.register('CommandOrControl+Shift+A',()=>{
    if(win.isVisible()) win.hide(); else {win.show();win.focus();}
  });
}
app.whenReady().then(createWindow).catch(error=>{
  console.error('ALE desktop gagal dimulai:',error.message);
  app.quit();
});
app.on('window-all-closed',()=>app.quit());
app.on('will-quit',()=>{
  globalShortcut.unregisterAll();
  if(localServer)localServer.close();
  mainWindow=null;
});
