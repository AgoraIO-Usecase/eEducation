import { AgoraRTCClient, AgoraStreamSpec, DeviceInfo } from './agora-rtc-client';
import { roomStore, RoomStore } from '../stores/room';
import { get, isEmpty } from 'lodash';
import EventEmitter from 'events';
import AgoraRTC from 'agora-rtc-sdk';
import { APP_ID } from './config';

export const createAudioStream = (microphoneId: string) => {
  const streamInitPromise = new Promise((resolve, reject) => {
    const stream = AgoraRTC.createStream({
      video: false,
      audio: true,
      microphoneId
    })
    stream.init(
      () => resolve(stream),
      (err: any) => reject(err)
    )
  })
  return streamInitPromise
}

export const createVideoStream = (cameraId: string) => {
  const streamInitPromise = new Promise((resolve, reject) => {
    const stream = AgoraRTC.createStream({
      video: true,
      audio: false,
      cameraId
    })
    stream.init(
      () => resolve(stream),
      (err: any) => reject(err)
    )
  })
  return streamInitPromise
}

async function getConnectedDevices(type: string) {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(device => device.kind === type)
}

export const getCameraDevices = async () => {
  const agoraVideoStream = AgoraRTC.createStream({video: true, audio: false})
  try {
    const requestVideoPermissionPromise = new Promise((resolve, reject) => {
      agoraVideoStream.init(() => resolve(null), (err: any) => reject(err))
    })
    await requestVideoPermissionPromise
    let videoDevices = await getConnectedDevices('videoinput');
    return videoDevices.map((device: any, idx: number) => ({
      deviceId: device.deviceId,
      text: device.label ? device.label : `camera-${idx}`
    }))
  } catch (err) {
    console.warn('create video stream failed!', err)
    throw err
  } finally {
    agoraVideoStream.close()
  }
}

export const getMicrophoneDevices = async () => {
  const agoraAudioStream = AgoraRTC.createStream({video: false, audio: true})
  try {
    const requestVideoPermissionPromise = new Promise((resolve, reject) => {
      agoraAudioStream.init(() => resolve(null), (err: any) => reject(err))
    })
    await requestVideoPermissionPromise
    let videoDevices = await getConnectedDevices('audioinput');
    return videoDevices.map((device: any, idx: number) => ({
      deviceId: device.deviceId,
      text: device.label ? device.label : `microphone-${idx}`
    }))
  } catch (err) {
    console.warn('create audio stream failed!', err)
    throw err
  } finally {
    agoraAudioStream.close()
  }
}

export class AgoraWebClient {

  public readonly rtc: AgoraRTCClient;
  public shareClient: AgoraRTCClient | any;
  public localUid: number;
  public channel: string;
  public readonly bus: EventEmitter;
  public shared: boolean;
  public joined: boolean;
  public cameraCanUse: boolean;
  public microphoneCanUse: boolean;
  public forceGetDevice: boolean;
  public published: boolean;
  public tmpStream: any;

  private roomStore: RoomStore;

  constructor(deps: {roomStore: RoomStore}) {
    this.localUid = 0;
    this.channel = '';
    this.rtc = new AgoraRTCClient();
    this.bus = new EventEmitter();
    this.shared = false;
    this.shareClient = null;
    this.tmpStream = null;
    this.joined = false;
    this.published = false;

    this.cameraCanUse = false;
    this.microphoneCanUse = false;
    this.forceGetDevice = false;
    
    this.roomStore = deps.roomStore;
  }

  async getDevices () {
    const client = new AgoraRTCClient()
    let deviceResult: DeviceInfo = {
      cameraCanUse: this.cameraCanUse,
      microphoneCanUse: this.microphoneCanUse,
      devices: []
    }
    try {
      if (!this.forceGetDevice) {
        deviceResult = await client.forceGetDevices()
        this.forceGetDevice = true
      } else {
        deviceResult = await client.getDevices()
      }
      const {cameraCanUse, microphoneCanUse, devices} = deviceResult

      this.cameraCanUse = cameraCanUse
      this.microphoneCanUse = microphoneCanUse

      const cameraList = devices.filter((it: any) => it.kind === 'videoinput')
      const microphoneList = devices.filter((it: any) => it.kind === 'audioinput')

      if (!cameraList.length) {
        console.warn('cameraList is empty', devices)
      }

      if (!microphoneList.length) {
        console.warn('microphoneList is empty', devices)
      }

      // const cameraId = cameraList[0].deviceId
      // const microphoneId = microphoneList[0].deviceId
      await client.initClient(APP_ID)
      // const params = {
      //   streamID: 0,
      //   audio: true,
      //   video: true,
      //   screen: false,
      //   microphoneId,
      //   cameraId,
      // }
      // await client.createLocalStream(params)
      return devices
    } catch(err) {
      throw err
    } finally {
      // client.destroyLocalStream()
    }
  }


  async joinChannel({
    uid, channel, dual, token, appId
  }: {
    uid: number,
    channel: string,
    dual: boolean,
    token: string,
    appId: string
  }) {
    this.localUid = +uid;
    this.channel = channel;
    console.log('channel', channel, 'dual', dual, this.localUid, appId)
    await this.rtc.createClient(appId, true);
    await this.rtc.join(this.localUid, channel, token);
    dual && await this.rtc.enableDualStream();
    this.joined = true;
    roomStore.setRTCJoined(true);
    console.log('join web agora sdk rtc success')
  }

  async leaveChannel() {
    this.localUid = 0;
    this.channel = '';
    try {
      await this.unpublishLocalStream();
      await this.rtc.leave();
      this.joined = false;
      roomStore.setRTCJoined(false);
    } catch (err) {
      throw err;
    } finally {
      this.rtc.destroy();
      this.rtc.destroyClient();
    }
  }

  async enableDualStream() {
    return this.rtc.enableDualStream();
  }

  async publishLocalStream(data: AgoraStreamSpec) {
    console.log(' publish local stream ', this.published);
    if (this.published) {
      await this.unpublishLocalStream();
      console.log('[agora-web] unpublished', this.published);
    }

    if (!data.cameraId || !data.microphoneId) {
      let devices = await this.getDevices()
      if (!data.cameraId) {
        data.cameraId = get(devices.filter((it: any) => it.kind === 'videoinput'), '[0].deviceId', '')
      }
      if (!data.microphoneId) {
        data.microphoneId = get(devices.filter((it: any) => it.kind === 'audioinput'), '[0].deviceId', '')
      }
    }

    await this.rtc.acquireMediaStream(data);
    await this.rtc.publish();
    this.published = true;
  }

  async unpublishLocalStream() {
    console.log('[agora-web] invoke unpublishStream');
    await this.rtc.unpublish();
    this.published = false;
  }

  async startScreenShare ({
    uid, channel, token, appId
  }: {
    uid: number,
    channel: string,
    token: string,
    appId: string,
  }) {
    console.log('startScreenShare ', uid, channel, token, appId)
    const shareClient = new AgoraRTCClient();
    try {
      await shareClient.createLocalStream({
        video: false,
        audio: false,
        screen: true,
        screenAudio: true,
        streamID: uid,
        microphoneId: '',
        cameraId: ''
      })
      await shareClient.createClient(appId);
      await shareClient.join(uid, channel, token);
      await shareClient.publish();
      this.shared = true;
      this.shareClient = shareClient
    } catch(err) {
      throw err
    }
  }

  async stopScreenShare () {
    await this.shareClient.unpublish();
    await this.shareClient.leave();
    this.shareClient.destroy();
    this.shareClient.destroyClient();
    this.shared = false;
    this.shareClient = undefined
  }

  async exit () {
    const errors: any[] = [];
    try {
      await this.leaveChannel();
    } catch(err) {
      errors.push({'rtcClient': err});
    }
    if (this.shared === true) {
      try {
        await this.shareClient.unpublish();
        await this.shareClient.leave();
      } catch (err) {
        errors.push({'shareClient': err});
      }
    }
    if (this.shareClient) {
      try {
        this.shareClient.destroy();
        this.shareClient.destroyClient();
      } catch(err) {
        errors.push({'shareClient': err});
      }
    }
    if (!isEmpty(errors)) {
      throw errors;
    }
  }

  async createPreviewStream({cameraId, microphoneId, speakerId}: any) {
    const tmpStream = AgoraRTC.createStream({
      video: true,
      audio: true,
      screen: false,
      cameraId,
      microphoneId,
      speakerId
    });

    if (this.tmpStream) {
      this.tmpStream.isPlaying() && this.tmpStream.stop();
      this.tmpStream.close();
    }

    return new Promise((resolve, reject) => {
      tmpStream.init(() => {
        this.tmpStream = tmpStream;
        resolve(tmpStream);
      }, (err: any) => {
        reject(err);
      })
    });
  }

  subscribe(stream: any) {
    this.rtc.subscribe(stream);
  }

  setRemoteVideoStreamType(stream: any, type: number) {
    this.rtc.setRemoteVideoStreamType(stream, type);
  }
}