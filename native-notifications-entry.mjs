import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const channelId = 'agenda-herinneringen';
let channelReady = false;

async function ensureChannel() {
  if (channelReady || Capacitor.getPlatform() !== 'android') return;
  await LocalNotifications.createChannel({
    id: channelId,
    name: 'Agenda herinneringen',
    description: 'Rustige herinneringen voor afspraken en vaste activiteiten',
    importance: 2,
    visibility: 0,
    vibration: false
  });
  channelReady = true;
}

async function ensurePermission() {
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') {
    permission = await LocalNotifications.requestPermissions();
  }
  return permission.display === 'granted';
}

window.StapNotifications = {
  isNative: Capacitor.isNativePlatform(),
  async hasPermission() {
    if (!Capacitor.isNativePlatform()) return false;
    const permission = await LocalNotifications.checkPermissions();
    return permission.display === 'granted';
  },
  async schedule(options) {
    if (!Capacitor.isNativePlatform()) return { status: 'website' };
    if (!(await ensurePermission())) return { status: 'denied' };
    await ensureChannel();
    await LocalNotifications.schedule({
      notifications: [{
        id: options.id,
        title: options.title,
        body: options.body,
        channelId,
        schedule: { at: new Date(options.at), allowWhileIdle: false }
      }],
      isExactNotification: false
    });
    return { status: 'scheduled' };
  },
  async cancel(id) {
    if (!Capacitor.isNativePlatform()) return;
    await LocalNotifications.cancel({ notifications: [{ id }] });
  }
};


window.StapBackup = {
  isNative: Capacitor.isNativePlatform(),
  async shareBackup(fileName, contents) {
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: contents,
      directory: Directory.Cache,
      encoding: 'utf8'
    });
    await Share.share({
      title: 'Reservekopie van Stap voor Stap',
      text: 'Bewaar dit bestand op een veilige plek. Je kunt het later terugzetten in Stap voor Stap.',
      files: [savedFile.uri],
      dialogTitle: 'Bewaar je reservekopie'
    });
  }
};
