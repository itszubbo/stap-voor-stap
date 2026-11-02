import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

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
