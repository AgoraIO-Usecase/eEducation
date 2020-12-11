import { Mutex } from './../../utils/mutex';
import uuidv4 from 'uuid/v4';
import { SimpleInterval } from './../mixin/simple-interval';
import { EduBoardService } from './../../sdk/board/edu-board-service';
import { EduRecordService } from './../../sdk/record/edu-record-service';
import { EduAudioSourceType, EduTextMessage, EduSceneType } from './../../sdk/education/interfaces/index';
import { RemoteUserRenderer } from './../../sdk/education/core/media-service/renderer/index';
import { RoomApi } from './../../services/room-api';
import { EduClassroomManager } from '@/sdk/education/room/edu-classroom-manager';
import { PeerInviteEnum } from '@/sdk/education/user/edu-user-service';
import { LocalUserRenderer, UserRenderer } from '../../sdk/education/core/media-service/renderer/index';
import { AppStore } from '@/stores/app/index';
import { AgoraWebRtcWrapper } from '../../sdk/education/core/media-service/web/index';
import { observable, computed, action, runInAction } from 'mobx';
import { AgoraElectronRTCWrapper } from '@/sdk/education/core/media-service/electron';
import { StartScreenShareParams, PrepareScreenShareParams } from '@/sdk/education/core/media-service/interfaces';
import { MediaService } from '@/sdk/education/core/media-service';
import { get } from 'lodash';
import { EduCourseState, EduUser, EduStream, EduVideoSourceType, EduRoleType } from '@/sdk/education/interfaces';
import { ChatMessage } from '@/utils/types';
import { t } from '@/i18n';
import { DialogType } from '@/components/dialog';

const delay = 2000

const ms = 500

export const networkQualities: {[key: string]: string} = {
  'excellent': 'network-good',
  'good': 'network-good',
  'poor': 'network-normal',
  'bad': 'network-normal',
  'very bad': 'network-bad',
  'down': 'network-bad',
  'unknown': 'network-normal',
}

export type EduMediaStream = {
  streamUuid: string
  userUuid: string
  renderer?: UserRenderer
  account: string
  local: boolean
  audio: boolean
  video: boolean
  showControls: boolean
}

export class RoomStore extends SimpleInterval {

  static resolutions: any[] = [
    {
      name: '480p',
      value: '480p_1',
    },
    {
      name: '720p',
      value: '720p_1',
    },
    {
      name: '1080p',
      value: '1080p_1'
    }
  ]

  @observable
  resolutionIdx: number = 0

  @observable
  deviceList: any[] = []

  @observable
  cameraLabel: string = '';

  @observable
  microphoneLabel: string = '';
  _totalVolume: any;

  @observable
  _cameraId: string = '';

  @observable
  _microphoneId: string = '';
  private _boardService?: EduBoardService;
  private _recordService?: EduRecordService;

  @computed
  get cameraId(): string {
    const defaultValue = ''
    const idx = this.cameraList.findIndex((it: any) => it.label === this.cameraLabel)
    if (this.cameraList[idx]) {
      return this.cameraList[idx].deviceId
    }
    return defaultValue
  }

  @computed
  get microphoneId(): string {
    const defaultValue = ''
    const idx = this.microphoneList.findIndex((it: any) => it.label === this.microphoneLabel)
    if (this.microphoneList[idx]) {
      return this.microphoneList[idx].deviceId
    }
    return defaultValue
  }

  @observable
  resolution: string = '480p_1'

  @computed
  get playbackVolume(): number {
    if (this._playbackVolume) {
      return this._playbackVolume
    }
    return this.mediaService.getPlaybackVolume()
  }

  @observable
  _playbackVolume: number = 0

  @action
  changePlaybackVolume(volume: number) {
    this.mediaService.changePlaybackVolume(volume)
    this._playbackVolume = volume
  }

  @observable
  _microphoneTrack?: any = undefined;
  @observable
  _cameraRenderer?: LocalUserRenderer = undefined;
  @observable
  _screenVideoRenderer?: LocalUserRenderer = undefined;

  @computed
  get cameraRenderer(): LocalUserRenderer | undefined {
    return this._cameraRenderer;
  }

  @observable
  totalVolume: number = 0;

  @computed
  get screenVideoRenderer(): LocalUserRenderer | undefined {
    return this._screenVideoRenderer;
  }

  appStore: AppStore;

  @observable
  currentWindowId: string = ''

  @observable
  customScreenShareWindowVisible: boolean = false;

  @observable
  customScreenShareItems: any[] = []

  @observable
  settingVisible: boolean = false

  autoplay: boolean = false

  @observable
  recordState: boolean = false

  @computed
  get remoteUsersRenderer() {
    return this.appStore.mediaStore.remoteUsersRenderer
  }

  startTime: number = 0

  constructor(appStore: AppStore) {
    super()
    this.appStore = appStore
  }

  get boardService(): EduBoardService {
    return this.appStore.boardService
  }

  get recordService(): EduRecordService {
    return this.appStore.recordService
  }

  @observable
  sharing: boolean = false;

  @action
  showSetting() {
    this.settingVisible = true
  }

  @action
  hideSetting() {
    this.settingVisible = false
  }

  @action
  resetCameraTrack () {
    this._cameraRenderer = undefined
  }

  @action
  resetMicrophoneTrack() {
    this._microphoneTrack = undefined
  }

  @action
  resetScreenTrack () {
    this._screenVideoRenderer = undefined
  }

  @action
  resetScreenStream() {
    if (this.screenVideoRenderer) {
      this.screenVideoRenderer.stop()
      this._screenVideoRenderer = undefined
    }
    if (this.screenEduStream) {
      this._screenEduStream = undefined
    }
  }

  @action
  reset() {
    this.appStore.mediaStore.resetRoomState()
    this.appStore.resetTime()
    this.recording = false
    this.resolutionIdx = 0
    this.totalVolume = 0
    this.cameraLabel = ''
    this.microphoneLabel = ''
    this.mediaService.reset()
    this.resetScreenStream()
    this.streamList = []
    this.userList = []
    this.customScreenShareWindowVisible = false
    this.currentWindowId = ''
    this.customScreenShareItems = []
    this.roomChatMessages = []
    this.isMuted = undefined
    this._cameraEduStream = undefined
    this._screenEduStream = undefined
    this._microphoneTrack = undefined
    this.recordId = ''
    this.joined = false
    this._hasCamera = undefined
    this._hasMicrophone = undefined
    this.microphoneLock = false
    this.cameraLock = false
    this.recordState = false
  }

  @action
  showScreenShareWindowWithItems () {
    if (this.isElectron) {
      this.mediaService.prepareScreenShare().then((items: any) => {
        runInAction(() => {
          this.customScreenShareWindowVisible = true
          this.customScreenShareItems = items
        })
      }).catch(err => {
        console.warn('show screen share window with items', err)
        if (err.code === 'ELECTRON_PERMISSION_DENIED') {
          this.appStore.uiStore.addToast(t('toast.failed_to_enable_screen_sharing_permission_denied'))
        } else {
          this.appStore.uiStore.addToast(t('toast.failed_to_enable_screen_sharing') + ` code: ${err.code}, msg: ${err.msg}`)
        }
      })
    }
  }

  get roomUuid(): string {
    return this.roomManager?.roomUuid
  }

  @action
  async startNativeScreenShareBy(windowId: number) {
    try {
      this.waitingShare = true
      await this.roomManager?.userService.startShareScreen()
      const params: any = {
        channel: this.roomManager?.roomUuid,
        uid: +this.roomManager?.userService.screenStream.stream.streamUuid,
        token: this.roomManager?.userService.screenStream.token,
      }
      await this.mediaService.startScreenShare({
        windowId: windowId as number,
        params
      })
      if (!this.mediaService.screenRenderer) {
        this.appStore.uiStore.addToast(t('create_screen_share_failed'))
        return
      } else {
        this._screenVideoRenderer = this.mediaService.screenRenderer
      }
      this.removeScreenShareWindow()
      this.sharing = true
    } catch (err) {
      console.warn(err)
      this.waitingShare = false
      this.appStore.uiStore.addToast(t('toast.failed_to_initiate_screen_sharing') + `${err.msg}`)
    }
  }

  @action
  removeScreenShareWindow () {
    if (this.isElectron) {
      this.customScreenShareWindowVisible = false
      this.customScreenShareItems = []
    }
  }

  @computed
  get cameraList() {
    return this.deviceList.filter((it: any) => it.kind === 'videoinput')
  }

  @computed
  get microphoneList() {
    return this.deviceList.filter((it: any) => it.kind === 'audioinput')
  }

  init(option: {video?: boolean, audio?: boolean} = {video: true, audio: true}) {
    if (option.video) {
      this.mediaService.getCameras().then((list: any[]) => {
        runInAction(() => {
          this.deviceList = list;
        })
      })
    }
    if (option.audio) {
      this.mediaService.getMicrophones().then((list: any[]) => {
        runInAction(() => {
          this.deviceList = list;
        })
      })
    }
  }

  release() {
    // this.mediaService.release()
  }

  get mediaService(): MediaService {
    return this.appStore.eduManager.mediaService as MediaService;
  }

  get web(): AgoraWebRtcWrapper {
    return (this.mediaService.sdkWrapper as AgoraWebRtcWrapper)
  }

  get isWeb(): boolean {
    return this.mediaService.sdkWrapper instanceof AgoraWebRtcWrapper
  }

  get isElectron(): boolean {
    return this.mediaService.sdkWrapper instanceof AgoraElectronRTCWrapper
  }

  private _hasCamera?: boolean = undefined
  private _hasMicrophone?: boolean = undefined

  public readonly mutex = new Mutex()

  public cameraLock: boolean = false

  lockCamera() {
    this.cameraLock = true
    console.log('[demo] lockCamera ')
  }

  unLockCamera() {
    this.cameraLock = false
    console.log('[demo] unlockCamera ')
  }

  @action
  async openCamera() {
    if (this._cameraRenderer) {
      return console.warn('[demo] Camera already exists')
    }
    if (this.cameraLock) {
      return console.warn('[demo] openCamera locking')
    }
    this.lockCamera()
    try {
      const deviceId = this._cameraId
      await this.mediaService.openCamera({deviceId})
      this._cameraRenderer = this.mediaService.cameraRenderer
      this.cameraLabel = this.mediaService.getCameraLabel()
      this._cameraId = this.cameraId
      console.log('[demo] action in openCamera >>> openCamera')
      this.unLockCamera()
    } catch (err) {
      this.unLockCamera()
      console.log('[demo] action in openCamera >>> openCamera')
      console.warn(err)
      throw err
    }
  }

  @action
  async muteLocalCamera() {
    if (this.cameraLock) {
      return console.warn('[demo] openCamera locking')
    }
    console.log('[demo] [local] muteLocalCamera')
    if (this._cameraRenderer) {
      await this.closeCamera()
      this.unLockCamera()
    }
    await this.roomManager?.userService.updateMainStreamState({'videoState': false})
  }

  @action 
  async unmuteLocalCamera() {
    console.log('[demo] [local] unmuteLocalCamera')
    if (this.cameraLock) {
      return console.warn('[demo] [mic lock] unmuteLocalCamera')
    }
    await this.openCamera()
    await this.roomManager?.userService.updateMainStreamState({'videoState': true})
  }

  @action
  async muteLocalMicrophone() {
    console.log('[demo] [local] muteLocalMicrophone')
    if (this.microphoneLock) {
      return console.warn('[demo] [mic lock] muteLocalMicrophone')
    }
    await this.closeMicrophone()
    this.unLockMicrophone()
    await this.roomManager?.userService.updateMainStreamState({'audioState': false})
  }

  @action 
  async unmuteLocalMicrophone() {
    console.log('[demo] [local] unmuteLocalMicrophone')
    if (this.microphoneLock) {
      return console.warn('[demo] [mic lock] unmuteLocalMicrophone')
    }
    await this.openMicrophone()
    await this.roomManager?.userService.updateMainStreamState({'audioState': true})
  }

  @action
  async closeCamera() {
    await this.mediaService.closeCamera()
    this.resetCameraTrack()
  }

  @action
  async changeCamera(deviceId: string) {
    await this.mediaService.changeCamera(deviceId)
    this.cameraLabel = this.mediaService.getCameraLabel()
    this._cameraId = deviceId
  }

  public microphoneLock: boolean = false

  lockMicrophone() {
    this.microphoneLock = true
    console.log('[demo] lockMicrophone ')
  }

  unLockMicrophone() {
    this.microphoneLock = false
    console.log('[demo] unLockMicrophone ')
  }

  @action
  async openMicrophone() {
    if (this._microphoneTrack) {
      return console.warn('[demo] Microphone already exists')
    }

    if (this.microphoneLock) {
      return console.warn('[demo] openMicrophone locking 1')
    }
    this.lockMicrophone()
    try {
      const deviceId = this._microphoneId
      await this.mediaService.openMicrophone({deviceId})
      this._microphoneTrack = this.mediaService.microphoneTrack
      this.microphoneLabel = this.mediaService.getMicrophoneLabel()
      console.log('[demo] action in openMicrophone >>> openMicrophone')
      this._microphoneId = this.microphoneId
      this.unLockMicrophone()
    } catch (err) {
      this.unLockMicrophone()
      console.log('[demo] action in openMicrophone >>> openMicrophone')
      console.warn(err)
      throw err
    }
  }

  @action
  async closeMicrophone() {
    if (this.microphoneLock) return console.warn('[demo] closeMicrophone microphone is locking')
    await this.mediaService.closeMicrophone()
    this.resetMicrophoneTrack()
  }

  @action
  async changeMicrophone(deviceId: string) {
    await this.mediaService.changeMicrophone(deviceId)
    this.microphoneLabel = this.mediaService.getMicrophoneLabel()
    this._microphoneId = deviceId
  }

  @action
  async changeResolution(resolution: any) {
    await this.mediaService.changeResolution(resolution)
    runInAction(() => {
      this.resolution = resolution
    })
  }

  @observable
  waitingShare: boolean = false

  @action
  async stopWebSharing() {
    try {
      this.waitingShare = true
      if (this._screenVideoRenderer) {
        await this.mediaService.stopScreenShare()
        this.mediaService.screenRenderer && this.mediaService.screenRenderer.stop()
        this._screenVideoRenderer = undefined
      }
      if (this._screenEduStream) {
        await this.roomManager?.userService.stopShareScreen()
        this._screenEduStream = undefined
      }
      this.sharing = false
    } catch(err) {
      this.appStore.uiStore.addToast(t('toast.failed_to_end_screen_sharing') + `${err.msg}`)
    } finally {
      this.waitingShare = false
    }
  }

  @action
  async startWebSharing() {
    try {
      this.waitingShare = true
      await this.mediaService.prepareScreenShare({
        shareAudio: 'auto',
        encoderConfig: '720p'
      })
      await this.roomManager?.userService.startShareScreen()
      const params: any = {
        channel: this.roomManager?.roomUuid,
        uid: +this.roomManager?.userService.screenStream.stream.streamUuid,
        token: this.roomManager?.userService.screenStream.token,
      }

      await this.mediaService.startScreenShare({
        params
      })
      this._screenEduStream = this.roomManager?.userService.screenStream.stream
      this._screenVideoRenderer = this.mediaService.screenRenderer
      this.sharing = true
    } catch (err) {
      if (this.mediaService.screenRenderer) {
        this.mediaService.screenRenderer.stop()
        this.mediaService.screenRenderer = undefined
        this._screenVideoRenderer = undefined
        this.appStore.uiStore.addToast(t('toast.failed_to_initiate_screen_sharing_to_remote') + `${err.msg}`)
      } else {
        if (err.code === 'PERMISSION_DENIED') {
          this.appStore.uiStore.addToast(t('toast.failed_to_enable_screen_sharing_permission_denied'))
        } else {
          this.appStore.uiStore.addToast(t('toast.failed_to_enable_screen_sharing') + ` code: ${err.code}, msg: ${err.msg}`)
        }
      }
      console.warn(err)
    } finally {
      this.waitingShare = false
    }
  }

  async startOrStopSharing() {
    if (this.isWeb) {
      if (this.sharing) {
        await this.stopWebSharing()
      } else {
        await this.startWebSharing()
      }
    }

    if (this.isElectron) {
      if (this.sharing) {
        await this.stopNativeSharing()
      } else {
        await this.showScreenShareWindowWithItems()
      }
    }
  }

  @action
  async prepareScreenShare(params: PrepareScreenShareParams = {}) {
    const res = await this.mediaService.prepareScreenShare(params)
    if (this.mediaService.screenRenderer) {
      this._screenVideoRenderer = this.mediaService.screenRenderer
    }
  }

  @action
  async stopNativeSharing() {
    if (this.screenEduStream) {
      await this.roomManager?.userService.stopShareScreen()
      this._screenEduStream = undefined
    }
    if (this._screenVideoRenderer) {
      await this.mediaService.stopScreenShare()
      this._screenVideoRenderer && this._screenVideoRenderer.stop()
      this._screenVideoRenderer = undefined
    }
    if (this.customScreenShareWindowVisible) {
      this.customScreenShareWindowVisible = false
    }
    this.customScreenShareItems = []
    this.sharing = false
  }

  @action
  async resetWebPrepareScreen() {
    if (this.mediaService.screenRenderer) {
      this.mediaService.screenRenderer
      this._screenVideoRenderer = undefined
    }
  }

  @observable
  userList: EduUser[] = []

  @observable
  streamList: EduStream[] = []

  @action
  async stopScreenShare() {

  }

  @observable
  unreadMessageCount: number = 0

  @observable
  messages: any[] = []

  @action
  async sendMessage(message: any) {
    try {
      await this.roomManager?.userService.sendRoomChatMessage(message)
      this.addChatMessage({
        id: this.userUuid,
        ts: +Date.now(),
        text: message,
        account: this.roomInfo.userName,
        sender: true,
      })
    } catch (err) {
      this.appStore.uiStore.addToast(t('toast.failed_to_send_chat'))
      console.warn(err)
    }
  }

  @observable
  joined: boolean = false

  @observable
  menuVisible: boolean = false

  @action
  toggleMenu() {
    this.menuVisible = !this.menuVisible
  }

  @observable
  activeTab: string = 'chatroom'

  @action
  switchTab(tab: string) {
    this.activeTab = tab
  }

  @computed
  get roomInfo() {
    return this.appStore.roomInfo
  }
  
  @action
  resetRoomInfo() {
    this.appStore.resetRoomInfo()
  }

  @observable
  classState: number = 0

  @observable
  _delay: number = 0

  @computed
  get delay(): string {
    return `${this.appStore.mediaStore.delay}`
  }

  @observable
  time: number = 0

  _roomManager?: EduClassroomManager = undefined;

  get roomManager(): EduClassroomManager {
    return this._roomManager as EduClassroomManager
  }

  @observable
  _cameraEduStream?: EduStream = undefined

  @observable
  _screenEduStream?: EduStream = undefined

  @computed
  get screenEduStream(): EduStream {
    return this._screenEduStream as EduStream
  }

  @computed
  get cameraEduStream(): EduStream {
    return this._cameraEduStream as EduStream
  }

  roomApi!: RoomApi

  @observable
  joiningRTC: boolean = false
  
  async joinRTC(args: any) {
    try {
      await this.mediaService.join(args)
      this.joiningRTC = true
    } catch (err) {
      this.appStore.uiStore.addToast(t('toast.failed_to_join_rtc_please_refresh_and_try_again'))
      console.warn(err)
      throw err
    }
  }

  async leaveRtc() {
    try {
      this.joiningRTC = false
      await this.closeCamera()
      await this.closeMicrophone()
      // await this.mediaService.closeCamera()
      // await this.mediaService.closeMicrophone()
      await this.mediaService.leave()
      this.appStore.uiStore.addToast(t('toast.leave_rtc_channel'))
      this.appStore.reset()
    } catch (err) {
      this.appStore.uiStore.addToast(t('toast.failed_to_leave_rtc'))
      console.warn(err)
    }
  }

  @action
  async prepareCamera() {
    if (this._hasCamera === undefined) {
      const cameras = await this.mediaService.getCameras()
      this._hasCamera = !!cameras.length
      if (this._hasCamera && this.mediaService.isWeb) {
        this.mediaService.web.publishedVideo = true
      }
    }
  }

  @action
  async prepareMicrophone() {
    if (this._hasMicrophone === undefined) {
      const microphones = await this.mediaService.getMicrophones()
      this._hasMicrophone = !!microphones.length
      if (this._hasMicrophone && this.mediaService.isWeb) {
        this.mediaService.web.publishedAudio = true
      }
    }
  }

  isBigClassStudent(): boolean {
    const userRole = this.roomInfo.userRole
    return +this.roomInfo.roomType === 2 && userRole === 'student'
  }

  get eduManager() {
    return this.appStore.eduManager
  }

  promiseLock(): Function {
    let promise: Promise<any>;

    return function(fn: Function) {
      return function(...args: any[]) {
        if (promise) {
          const resultPromise = promise.then(() => fn(...args));
          promise = resultPromise.then(() => undefined);
          return resultPromise;
        }
        promise = fn(...args);
        return promise;
      };
    };
  }

  @action
  async join(urlParams: URLSearchParams) {
    try {
      this.appStore.uiStore.startLoading()
      this.roomApi = new RoomApi()
      // 在这里加入你的请求逻辑
      /**
        * let res = await this.axios.post<T>(path, null, params)
       */

      /**
       * http://localhost:3000/?your_room_type=xxx
       * const your_room_type = urlParams.get("your_room_type") 
       * 通过url获取 your_room_type的值
       */

      // 这里是教育demo的核心逻辑 需要把this.roomInfo 相关的代码都替换为url params传递进来的值
      let {roomUuid} = await this.roomApi.fetchRoom({
        roomName: `${this.roomInfo.roomName}`,
        roomType: +this.roomInfo.roomType as number,
      })
      await this.eduManager.login(this.userUuid)
  
      const roomManager = this.eduManager.createClassroom({
        roomUuid: roomUuid,
        roomName: this.roomInfo.roomName
      })
      roomManager.on('seqIdChanged', (evt: any) => {
        console.log("seqIdChanged", evt)
        this.appStore.uiStore.updateCurSeqId(evt.curSeqId)
        this.appStore.uiStore.updateLastSeqId(evt.latestSeqId)
      })
      // 本地用户更新
      roomManager.on('local-user-updated', (evt: any) => {
        this.userList = roomManager.getFullUserList()
        console.log("local-user-updated", evt)
      })
      // 本地流移除
      roomManager.on('local-stream-removed', async (evt: any) => {
        await this.mutex.dispatch<Promise<void>>(async () => {
          if (!this.joiningRTC) {
            return 
          }
          try {
            const tag = uuidv4()
            console.log(`[demo] tag: ${tag}, [${Date.now()}], handle event: local-stream-removed, `, JSON.stringify(evt))
            if (evt.type === 'main') {
              this._cameraEduStream = undefined
              await this.closeCamera()
              await this.closeMicrophone()
              console.log(`[demo] tag: ${tag}, [${Date.now()}], main stream closed local-stream-removed, `, JSON.stringify(evt))
            }
            console.log("[demo] local-stream-removed emit done", evt)
          } catch (error) {
            console.error(`[demo] local-stream-removed async handler failed`)
            console.error(error)
          }
        })
      })
      // 本地流加入
      // roomManager.on('local-stream-added', (evt: any) => {
      //   this.streamList = roomManager.getFullStreamList()
      //   console.log("local-stream-added", evt)
      // })
      // 本地流更新
      roomManager.on('local-stream-updated', async (evt: any) => {
        await this.mutex.dispatch<Promise<void>>(async () => {
          if (!this.joiningRTC) {
            return 
          }
          const tag = uuidv4()
          console.log(`[demo] tag: ${tag}, seq[${evt.seqId}] time: ${Date.now()} local-stream-updated, `, JSON.stringify(evt))
          if (evt.type === 'main') {
            const localStream = roomManager.getLocalStreamData()
            console.log(`[demo] local-stream-updated tag: ${tag}, time: ${Date.now()} local-stream-updated, main stream `, JSON.stringify(localStream), this.joiningRTC)
            if (localStream && localStream.state !== 0) {
              console.log(`[demo] local-stream-updated tag: ${tag}, time: ${Date.now()} local-stream-updated, main stream is online`, ' _hasCamera', this._hasCamera, ' _hasMicrophone ', this._hasMicrophone, this.joiningRTC)
              this._cameraEduStream = localStream.stream
              await this.prepareCamera()
              await this.prepareMicrophone()
              console.log(`[demo] tag: ${tag}, seq[${evt.seqId}], time: ${Date.now()} local-stream-updated, main stream is online`, ' _hasCamera', this._hasCamera, ' _hasMicrophone ', this._hasMicrophone, this.joiningRTC, ' _eduStream', JSON.stringify(this._cameraEduStream))
              if (this.joiningRTC) {
                if (this._hasCamera) {
                  if (this.cameraEduStream.hasVideo) {
                    await this.openCamera()
                    console.log(`[demo] local-stream-updated tag: ${tag}, seq[${evt.seqId}], time: ${Date.now()}  after openCamera  local-stream-updated, main stream is online`, ' _hasCamera', this._hasCamera, ' _hasMicrophone ', this._hasMicrophone, this.joiningRTC, ' _eduStream', JSON.stringify(this._cameraEduStream))
                  } else {
                    await this.closeCamera()
                    console.log(`[demo] local-stream-updated tag: ${tag}, seq[${evt.seqId}], time: ${Date.now()}  after closeCamera  local-stream-updated, main stream is online`, ' _hasCamera', this._hasCamera, ' _hasMicrophone ', this._hasMicrophone, this.joiningRTC, ' _eduStream', JSON.stringify(this._cameraEduStream))
                  }
                }
                if (this._hasMicrophone) {
                  if (this.cameraEduStream.hasAudio) {
                    console.log('open microphone')
                    await this.openMicrophone()
                    console.log(`[demo] local-stream-updated tag: ${tag}, seq[${evt.seqId}], time: ${Date.now()} after openMicrophone  local-stream-updated, main stream is online`, ' _hasCamera', this._hasCamera, ' _hasMicrophone ', this._hasMicrophone, this.joiningRTC, ' _eduStream', JSON.stringify(this._cameraEduStream))
                  } else {
                    console.log('close local-stream-updated microphone')
                    await this.closeMicrophone()
                    console.log(`[demo] local-stream-updated tag: ${tag}, seq[${evt.seqId}], time: ${Date.now()}  after closeMicrophone  local-stream-updated, main stream is online`, ' _hasCamera', this._hasCamera, ' _hasMicrophone ', this._hasMicrophone, this.joiningRTC, ' _eduStream', JSON.stringify(this._cameraEduStream))
                  }
                }
              }
            } else {
              console.log("reset camera edu stream", JSON.stringify(localStream), localStream && localStream.state)
              this._cameraEduStream = undefined
            }
          }
    
          if (evt.type === 'screen') {
            if (this.roomInfo.userRole === 'teacher') {
              const screenStream = roomManager.getLocalScreenData()
              console.log("local-stream-updated getLocalScreenData#screenStream ", JSON.stringify(screenStream))
              if (screenStream && screenStream.state !== 0) {
                this._screenEduStream = screenStream.stream
                this.sharing = true
              } else {
                console.log("local-stream-updated reset screen edu stream", screenStream, screenStream && screenStream.state)
                this._screenEduStream = undefined
                this.sharing = false
              }
            }
          }
    
          console.log(`[demo] local-stream-updated tag: ${tag}, seq[${evt.seqId}], time: ${Date.now()} local-stream-updated emit done`, evt)
          console.log(`[demo] local-stream-updated tag: ${tag}, seq[${evt.seqId}], time: ${Date.now()} local-stream-updated emit done`, ' _hasCamera', this._hasCamera, ' _hasMicrophone ', this._hasMicrophone, this.joiningRTC, ' _eduStream', JSON.stringify(this._cameraEduStream))
        })
      })
      // 远端人加入
      roomManager.on('remote-user-added', (evt: any) => {
        runInAction(() => {
          this.userList = roomManager.getFullUserList()
        })
        console.log("remote-user-added", evt)
      })
      // 远端人更新
      roomManager.on('remote-user-updated', (evt: any) => {
        runInAction(() => {
          this.userList = roomManager.getFullUserList()
        })
        console.log("remote-user-updated", evt)
      })
      // 远端人移除
      roomManager.on('remote-user-removed', (evt: any) => {
        runInAction(() => {
          this.userList = roomManager.getFullUserList()
        })
        console.log("remote-user-removed", evt)
      })
      // 远端流加入
      roomManager.on('remote-stream-added', (evt: any) => {
        runInAction(() => {
          this.streamList = roomManager.getFullStreamList()
          if (this.roomInfo.userRole !== 'teacher') {
            if (this.streamList.find((it: EduStream) => it.videoSourceType === EduVideoSourceType.screen)) {
              this.sharing = true
            } else { 
              this.sharing = false
            }
          }
        })
        console.log("remote-stream-added", evt)
      })
      // 远端流移除
      roomManager.on('remote-stream-removed', (evt: any) => {
        runInAction(() => {
          this.streamList = roomManager.getFullStreamList()
          if (this.roomInfo.userRole !== 'teacher') {
            if (this.streamList.find((it: EduStream) => it.videoSourceType === EduVideoSourceType.screen)) {
              this.sharing = true
            } else { 
              this.sharing = false
            }
          }
        })
        console.log("remote-stream-removed", evt)
      })
      // 远端流更新
      roomManager.on('remote-stream-updated', (evt: any) => {
        runInAction(() => {
          this.streamList = roomManager.getFullStreamList()
          if (this.roomInfo.userRole !== 'teacher') {
            if (this.streamList.find((it: EduStream) => it.videoSourceType === EduVideoSourceType.screen)) {
              this.sharing = true
            } else { 
              this.sharing = false
            }
          }
        })
        console.log("remote-stream-updated", evt)
      })
      const decodeMsg = (str: string) => {
        try {
          return JSON.parse(str)
        } catch(err) {
          console.warn(err)
          return null
        }
      }
      this.eduManager.on('user-message', async (evt: any) => {
        await this.mutex.dispatch<Promise<void>>(async () => {
          if (!this.joiningRTC) {
            return 
          }
          try {
            console.log('[rtm] user-message', evt)
            const fromUserUuid = evt.message.fromUser.userUuid
            const fromUserName = evt.message.fromUser.userName
            const msg = decodeMsg(evt.message.message)
            console.log("user-message", msg)
            if (msg) {
              const {cmd, data} = msg
              const {type, userName} = data
              console.log("data", data)
              this.showNotice(type as PeerInviteEnum, fromUserUuid)
              if (type === PeerInviteEnum.studentApply) {
                this.showDialog(fromUserName, fromUserUuid)
              }
              if (type === PeerInviteEnum.teacherStop) {
                try {
                  await this.closeCamera()
                  await this.closeMicrophone()
                  this.appStore.uiStore.addToast(t('toast.co_video_close_success'))
                } catch (err) {
                  this.appStore.uiStore.addToast(t('toast.co_video_close_failed'))
                  console.warn(err)
                }
              }
              if (type === PeerInviteEnum.teacherAccept 
                && this.isBigClassStudent()) {
                try {
                  await this.prepareCamera()
                  await this.prepareMicrophone()
                  console.log("propertys ", this._hasCamera, this._hasMicrophone)
                  if (this._hasCamera) {
                    await this.openCamera()
                  }
      
                  if (this._hasMicrophone) {
                    console.log('open microphone')
                    await this.openMicrophone()
                  }
                } catch (err) {
                  console.warn('published failed', err) 
                  throw err
                }
                this.appStore.uiStore.addToast(t('toast.publish_rtc_success'))
              }
            }
          } catch (error) {
            console.error(`[demo] user-message async handler failed`)
            console.error(error)
          }
        })
      })
      // 教室更新
      roomManager.on('classroom-property-updated', (classroom: any) => {
        console.log("classroom-property-updated", classroom)
        // if (evt.reason === EduClassroomStateType.EduClassroomStateTypeRoomAttrs) {
          const record = get(classroom, 'roomProperties.record')
          if (record) {
            const state = record.state
            if (state === 1) {
              this.recordState = true
            } else {
              if (state === 0 && this.recordState) {
                this.addChatMessage({
                  id: 'system',
                  ts: Date.now(),
                  text: '',
                  account: 'system',
                  link: this.roomUuid,
                  sender: false
                })
                this.recordState = false
                this.recordId = ''
              }
            }
          }
          const newClassState = classroom.roomStatus.courseState
          if (this.classState !== newClassState) {
            this.classState = newClassState
            if (this.classState === 1) {
              this.startTime = get(classroom, 'roomStatus.startTime', 0)
              this.addInterval('timer', () => {
                this.appStore.updateTime(+get(classroom, 'roomStatus.startTime', 0))
              }, ms)
            } else {
              this.startTime = get(classroom, 'roomStatus.startTime', 0)
              console.log("end timeer", this.startTime)
              this.delInterval('timer')
            }
          }
          this.isMuted = !classroom.roomStatus.isStudentChatAllowed
      })
      roomManager.on('room-chat-message', (evt: any) => {
        const {textMessage} = evt;
        const message = textMessage as EduTextMessage
        this.addChatMessage({
          id: message.fromUser.userUuid,
          ts: message.timestamp,
          text: message.message,
          account: message.fromUser.userName,
          sender: false
        })
        console.log('room-chat-message', evt)
      })
  
      if (this.roomInfo.userRole === 'teacher') {
        await roomManager.join({
          userRole: `host`,
          roomUuid,
          userName: `${this.roomInfo.userName}`,
          userUuid: `${this.userUuid}`,
          autoPublish: true,
        })
      } else {
        const sceneType = +this.roomInfo.roomType === 2 ? EduSceneType.SceneLarge : +this.roomInfo.roomType
        const userRole = sceneType === EduSceneType.SceneLarge ? 'audience' : 'broadcaster'
        await roomManager.join({
          userRole: userRole,
          roomUuid,
          userName: `${this.roomInfo.userName}`,
          userUuid: `${this.userUuid}`,
          autoPublish: true,
          sceneType,
        })
      }
      this._roomManager = roomManager;
      this.appStore._boardService = new EduBoardService(roomManager.userToken, roomManager.roomUuid)
      this.appStore._recordService = new EduRecordService(roomManager.userToken)
  
      const roomInfo = roomManager.getClassroomInfo()
      this.startTime = +get(roomInfo, 'roomStatus.startTime', 0)

      const mainStream = roomManager.data.streamMap['main']
  
      this.classState = roomInfo.roomStatus.courseState

      if (this.classState === 1) {
        this.addInterval('timer', () => {
          this.appStore.updateTime(+get(roomInfo, 'roomStatus.startTime', 0))
        }, ms)
      }
      this.isMuted = !roomInfo.roomStatus.isStudentChatAllowed
  
      await this.joinRTC({
        uid: +mainStream.streamUuid,
        channel: roomInfo.roomInfo.roomUuid,
        token: mainStream.rtcToken
      })
  
      const localStreamData = roomManager.data.localStreamData
  
      let canPublish = this.roomInfo.userRole === 'teacher' ||
         localStreamData && !!(+localStreamData.state) ||
         (this.roomInfo.userRole === 'student' && +this.roomInfo.roomType !== 2)
  
      if (canPublish) {
  
        const localStreamData = roomManager.data.localStreamData
  
        console.log("localStreamData", localStreamData)
        await roomManager.userService.publishStream({
          videoSourceType: EduVideoSourceType.camera,
          audioSourceType: EduAudioSourceType.mic,
          streamUuid: mainStream.streamUuid,
          streamName: '',
          hasVideo: localStreamData && localStreamData.stream ? localStreamData.stream.hasVideo : true,
          hasAudio: localStreamData && localStreamData.stream ? localStreamData.stream.hasAudio : true,
          userInfo: {} as EduUser
        })
        this.appStore.uiStore.addToast(t('toast.publish_business_flow_successfully'))
        this._cameraEduStream = this.roomManager.userService.localStream.stream
        try {
          await this.prepareCamera()
          await this.prepareMicrophone()
          if (this._cameraEduStream) {
            if (this._cameraEduStream.hasVideo) {
              await this.openCamera()
            } else {
              await this.closeCamera()
            }
            if (this._cameraEduStream.hasAudio) {
              console.log('open microphone')
              await this.openMicrophone()
            } else {
              console.log('close microphone')
              await this.closeMicrophone()
            }
          }
        } catch (err) {
          this.appStore.uiStore.addToast(t('toast.media_method_call_failed') + `: ${err.msg}`)
          console.warn(err)
        }
      }
  
      await this.appStore.boardStore.init()
  
      const roomProperties = roomManager.getClassroomInfo().roomProperties
      if (roomProperties) {
        this.recordId = get(roomProperties, 'record.recordId', '')
      } else {
        this.recordId = ''
      }
    
      this.userList = roomManager.getFullUserList()
      this.streamList = roomManager.getFullStreamList()
      if (this.roomInfo.userRole !== 'teacher') {
        if (this.streamList.find((it: EduStream) => it.videoSourceType === EduVideoSourceType.screen)) {
          this.sharing = true
        } else { 
          this.sharing = false
        }
      }
      this.appStore.uiStore.stopLoading()
      this.joined = true
    } catch (err) {
      this.appStore.uiStore.stopLoading()
      throw err
    }
  }

  get teacherUuid(): string {
    const teacher = this.userList.find((it: EduUser) => it.role === EduRoleType.teacher)
    if (teacher) {
      return teacher.userUuid
    }
    return ''
  }

  get localUser(): any {
    return this.roomInfo
  }

  @computed
  get teacherStream(): EduMediaStream {
    // 当本地是老师时
    const localUser = this.localUser
    if (localUser && localUser.userRole === 'teacher'
      && this.cameraEduStream) {
      return {
        local: true,
        userUuid: this.appStore.userUuid,
        account: localUser.userName,
        streamUuid: this.cameraEduStream.streamUuid,
        video: this.cameraEduStream.hasVideo,
        audio: this.cameraEduStream.hasAudio,
        renderer: this.cameraRenderer as LocalUserRenderer,
        showControls: this.canControl(this.appStore.userUuid)
      }
    }

    // 当远端是老师时
    const teacherStream = this.streamList.find((it: EduStream) => it.userInfo.role as string === 'host' && it.userInfo.userUuid === this.teacherUuid && it.videoSourceType !== EduVideoSourceType.screen) as EduStream
    if (teacherStream) {
      const user = this.getUserBy(teacherStream.userInfo.userUuid as string) as EduUser
      return {
        local: false,
        account: user.userName,
        userUuid: user.userUuid,
        streamUuid: teacherStream.streamUuid,
        video: teacherStream.hasVideo,
        audio: teacherStream.hasAudio,
        renderer: this.remoteUsersRenderer.find((it: RemoteUserRenderer) => +it.uid === +teacherStream.streamUuid) as RemoteUserRenderer,
        showControls: this.canControl(user.userUuid)
      }
    }

    return {
      account: 'teacher',
      streamUuid: '',
      userUuid: '',
      local: false,
      video: false,
      audio: false,
      renderer: undefined,
      showControls: false
    }
  }

  private getUserBy(userUuid: string): EduUser {
    return this.userList.find((it: EduUser) => it.userUuid === userUuid) as EduUser
  }

  private getStreamBy(userUuid: string): EduStream {
    return this.streamList.find((it: EduStream) => it.userInfo.userUuid as string === userUuid) as EduStream
  }

  @computed
  get screenShareStream(): EduMediaStream {
    // 当本地存在业务流时
    if (this.screenEduStream) {
      return {
        local: true,
        account: '',
        userUuid: this.screenEduStream.userInfo.userUuid as string,
        streamUuid: this.screenEduStream.streamUuid,
        video: this.screenEduStream.hasVideo,
        audio: this.screenEduStream.hasAudio,
        renderer: this._screenVideoRenderer as LocalUserRenderer,
        showControls: false
      }
    } else {
      return this.streamList.reduce((acc: EduMediaStream[], stream: EduStream) => {
        const teacher = this.userList.find((user: EduUser) => user.role === 'host')
        if (!teacher || stream.userInfo.userUuid !== teacher.userUuid || stream.videoSourceType !== EduVideoSourceType.screen) {
          return acc;
        } else {
          acc.push({
            local: false,
            account: '',
            userUuid: stream.userInfo.userUuid,
            streamUuid: stream.streamUuid,
            video: stream.hasVideo,
            audio: stream.hasAudio,
            renderer: this.remoteUsersRenderer.find((it: RemoteUserRenderer) => +it.uid === +stream.streamUuid) as RemoteUserRenderer,
            showControls: false
          })
        }
        return acc;
      }, [])[0]
    }
  }

  isLocalStream(stream: EduStream): boolean {
    return this.appStore.userUuid === stream.userInfo.userUuid
  }

  @computed
  get studentStreams(): EduMediaStream[] {
    let streamList = this.streamList.reduce(
      (acc: EduMediaStream[], stream: EduStream) => {
        const user = this.userList.find((user: EduUser) => (user.userUuid === stream.userInfo.userUuid && ['broadcaster', 'audience'].includes(user.role)))
        if (!user || this.isLocalStream(stream)) return acc;
        acc.push({
          local: false,
          account: user.userName,
          userUuid: stream.userInfo.userUuid as string,
          streamUuid: stream.streamUuid,
          video: stream.hasVideo,
          audio: stream.hasAudio,
          renderer: this.remoteUsersRenderer.find((it: RemoteUserRenderer) => +it.uid === +stream.streamUuid) as RemoteUserRenderer,
          showControls: this.canControl(user.userUuid)
        })
        return acc;
      }
    , [])

    const localUser = this.localUser

    const isStudent = ['student'].includes(localUser.userRole)

    if (this.cameraEduStream && isStudent) {
      streamList = [{
        local: true,
        account: localUser.userName,
        userUuid: this.cameraEduStream.userInfo.userUuid as string,
        streamUuid: this.cameraEduStream.streamUuid,
        video: this.cameraEduStream.hasVideo,
        audio: this.cameraEduStream.hasAudio,
        renderer: this.cameraRenderer as LocalUserRenderer,
        showControls: this.canControl(this.appStore.userUuid)
      } as EduMediaStream].concat(streamList.filter((it: any) => it.userUuid !== this.appStore.userUuid))
    }
    return streamList
  }

  @action
  async leave() {
    try {
      this.joiningRTC = true
      await this.leaveRtc()
      await this.appStore.boardStore.leave()
      await this.eduManager.logout()
      await this.roomManager?.leave()
      this.appStore.uiStore.addToast(t('toast.successfully_left_the_business_channel'))
      this.delInterval('timer')
      this.reset()
      this.resetRoomInfo()
      this.appStore.uiStore.updateCurSeqId(0)
      this.appStore.uiStore.updateLastSeqId(0)
    } catch (err) {
      this.reset()
      console.error(err)
    }
  }

  @action
  async startClass() {
    try {
      await this.roomManager?.userService.updateCourseState(EduCourseState.EduCourseStateStart)
      // this.classState = true
      this.appStore.uiStore.addToast(t('toast.course_started_successfully'))
    } catch (err) {
      console.log(err)
      this.appStore.uiStore.addToast(t('toast.setting_start_failed'))
    }
  }

  @action
  async stopClass() {
    try {
      await this.roomManager?.userService.updateCourseState(EduCourseState.EduCourseStateStop)
      this.appStore.uiStore.addToast(t('toast.the_course_ends_successfully'))
    } catch (err) {
      console.log(err)
      this.appStore.uiStore.addToast(t('toast.setting_ended_failed'))
    }
  }

  @computed
  get mutedChat(): boolean {
    if (this.isMuted !== undefined) {
      return this.isMuted
    }
    const classroom = this.roomManager?.getClassroomInfo()
    if (classroom && classroom.roomStatus) {
      return !classroom.roomStatus.isStudentChatAllowed
    }
    return true
  }

  @observable
  isMuted?: boolean = undefined

  @action
  async muteChat() {
    const sceneType = +this.roomInfo.roomType === 2 ? EduSceneType.SceneLarge : +this.roomInfo.roomType
    const roles = ['broadcaster']
    if (sceneType === EduSceneType.SceneLarge) {
      roles.push('audience')
    }
    await this.roomManager?.userService.muteStudentChatByRoles(roles)
    this.isMuted = true
  }

  @action
  async unmuteChat() {
    const sceneType = +this.roomInfo.roomType === 2 ? EduSceneType.SceneLarge : +this.roomInfo.roomType
    const roles = ['broadcaster']
    if (sceneType === EduSceneType.SceneLarge) {
      roles.push('audience')
    }
    await this.roomManager?.userService.unmuteStudentChatByRoles(roles)
    this.isMuted = false
  }

  canControl(userUuid: string): boolean {
    return this.roomInfo.userRole === 'teacher' || this.userUuid === userUuid
  }

  private _unreadMessageCount: number = 0

  // @computed
  // get unreadMessageCount(): number {
  //   return this._unreadMessageCount
  // }

  @observable
  roomChatMessages: ChatMessage[] = []

  @action
  addChatMessage(args: any) {
    this.roomChatMessages.push(args)
  }

  @computed
  get muteControl(): boolean {
    if (this.roomInfo) {
      return this.roomInfo.userRole === 'teacher'
    }
    return false
  }

  get userUuid() {
    return `${this.appStore.userUuid}`
  }

  async closeStream(userUuid: string, isLocal: boolean) {
    console.log("closeStream", userUuid, isLocal)
    if (isLocal) {
      if (this.cameraEduStream) {
        await this.roomManager?.userService.unpublishStream({
          streamUuid: this.cameraEduStream.streamUuid,
        })
        console.log("closeStream ", this.userUuid)
        if (this.userUuid === userUuid) {
          console.log("准备结束摄像头")
          this._cameraEduStream = undefined
          await this.mediaService.unpublish()
          await this.mediaService.closeCamera()
          await this.mediaService.closeMicrophone()
        }
      }
    } else {
      if (this.roomManager?.userService) {
        const targetStream = this.streamList.find((it: EduStream) => it.userInfo.userUuid === userUuid)
        const targetUser = this.userList.find((it: EduUser) => it.userUuid === targetStream?.userInfo.userUuid)
        if (targetUser) {
          await this.roomManager?.userService.teacherCloseStream(targetUser)
          await this.roomManager?.userService.remoteCloseStudentStream(targetStream as EduStream)
        }
      }
    }
  }

  async muteAudio(userUuid: string, isLocal: boolean) {
    if (isLocal) {
      console.log('before muteLocalAudio', this.microphoneLock)
      await this.muteLocalMicrophone()
      console.log('after muteLocalAudio', this.microphoneLock)
    } else {
      const stream = this.getStreamBy(userUuid)
      const targetStream = this.streamList.find((it: EduStream) => it.userInfo.userUuid === userUuid)
      await this.roomManager?.userService.remoteStopStudentMicrophone(targetStream as EduStream)
    }
  }

  async unmuteAudio(userUuid: string, isLocal: boolean) {
    console.log("unmuteAudio", userUuid, isLocal)
    if (isLocal) {
      await this.unmuteLocalMicrophone()
    } else {
      const stream = this.getStreamBy(userUuid)
      if (stream && this.mediaService.isElectron) {
        await this.mediaService.muteRemoteAudio(+stream.streamUuid, false)
      }
      const targetStream = this.streamList.find((it: EduStream) => it.userInfo.userUuid === userUuid)
      await this.roomManager?.userService.remoteStartStudentMicrophone(targetStream as EduStream)
    }
  }

  async muteVideo(userUuid: string, isLocal: boolean) {
    console.log("muteVideo", userUuid, isLocal)
    if (isLocal) {
      console.log('before muteLocalCamera', this.cameraLock)
      await this.muteLocalCamera()
      console.log('after muteLocalCamera', this.cameraLock)
    } else {
      const stream = this.getStreamBy(userUuid)
      const targetStream = this.streamList.find((it: EduStream) => it.userInfo.userUuid === userUuid)
      await this.roomManager?.userService.remoteStopStudentCamera(targetStream as EduStream)
    }
  }

  async unmuteVideo(userUuid: string, isLocal: boolean) {
    console.log("unmuteVideo", userUuid, isLocal)
    if (isLocal) {
      console.log('before unmuteLocalCamera', this.cameraLock)
      await this.unmuteLocalCamera()
      console.log('after unmuteLocalCamera', this.cameraLock)
    } else {
      const stream = this.getStreamBy(userUuid)
      if (stream && this.mediaService.isElectron) {
        await this.mediaService.muteRemoteVideo(+stream.streamUuid, false)
      }
      const targetStream = this.streamList.find((it: EduStream) => it.userInfo.userUuid === userUuid)
      await this.roomManager?.userService.remoteStartStudentCamera(targetStream as EduStream)
    }
  }

  @observable
  recordId: string = ''

  @observable
  recording: boolean = false

  @computed
  get isRecording(): boolean {
    if (this.recordId) return true
    return false
  }

  async startOrStopRecording(){
    try {
      this.recording = true
      if (this.isRecording) {
        await this.stopRecording()
      } else {
        await this.startRecording()
      }
      this.recording = false
    } catch (err) {
      this.recording = false
    }
  }

  @action
  async startRecording() {
    try {
      let {recordId} = await this.recordService.startRecording(this.roomUuid)
      this.recordId = recordId
      this.appStore.uiStore.addToast(t('toast.start_recording_successfully'))
    } catch (err) {
      this.appStore.uiStore.addToast(t('toast.start_recording_failed') + `, ${err.msg}`)
    }
  }

  @action
  async stopRecording() {
    try {
      await this.recordService.stopRecording(this.roomUuid, this.recordId)
      this.appStore.uiStore.addToast(t('toast.successfully_ended_recording'))
      this.recordId = ''
    } catch (err) {
      this.appStore.uiStore.addToast(t('toast.failed_to_end_recording') + `, ${err.msg}`)
    }
  }

  @observable
  notice?: any = undefined

  @action
  showNotice(type: PeerInviteEnum, userUuid: string) {
    let text = t('toast.you_have_a_default_message')
    switch(type) {
      case PeerInviteEnum.teacherAccept: {
        text = t('toast.the_teacher_agreed')
        break;
      }
      case PeerInviteEnum.studentApply: {
        text = t('toast.student_applied')
        break;
      }
      case PeerInviteEnum.teacherStop: {
        text = t('toast.you_were_dismissed_by_the_teacher')
        break;
      }
      case PeerInviteEnum.studentStop:
      case PeerInviteEnum.studentCancel: 
        text = t('toast.student_canceled')
        this.removeDialogBy(userUuid)
        break;
      case PeerInviteEnum.teacherReject: {
        text = t('toast.the_teacher_refused')
        break;
      }
    }
    this.notice = {
      reason: text,
      userUuid
    }
    this.appStore.uiStore.addToast(this.notice.reason)
  }

  @action
  async callApply() {
    try {
      const teacher = this.roomManager?.getFullUserList().find((it: EduUser) => it.userUuid === this.teacherStream.userUuid)
      if (teacher) {
        await this.roomManager?.userService.sendCoVideoApply(teacher)
      }
    } catch (err) {
      this.appStore.uiStore.addToast(t('toast.failed_to_initiate_a_raise_of_hand_application') + ` ${err.msg}`)
    }
  }

  @action
  async callEnded() {
    try {
      await this.closeStream(this.roomInfo.userUuid, true)
    } catch (err) {
      this.appStore.uiStore.addToast(t('toast.failed_to_end_the_call') + ` ${err.msg}`)
    }
  }

  showDialog(userName: string, userUuid: any) {
    const isExists = this.appStore
      .uiStore
      .dialogs.filter((it: DialogType) => it.dialog.userUuid)
      .find((it: DialogType) => it.dialog.userUuid === userUuid)
    if (isExists) {
      return
    }
    this.appStore.uiStore.showDialog({
      type: 'apply',
      userUuid: userUuid,
      message: `${userName}` + t('icon.requests_to_connect_the_microphone')
    })
  }

  removeDialogBy(userUuid: any) {
    const target = this.appStore
    .uiStore
    .dialogs.filter((it: DialogType) => it.dialog.userUuid)
    .find((it: DialogType) => it.dialog.userUuid === userUuid)
    if (target) {
      this.appStore.uiStore.removeDialog(target.id)
    }
  }

  async teacherRejectApply() {
    const userUuid = (this.notice as any).userUuid
    const user = this.roomManager?.getFullUserList().find(it => it.userUuid === userUuid)
    if (user) {
      await this.roomManager?.userService.rejectCoVideoApply(user)
    }
  }

  async teacherAcceptApply() {
    const userUuid = (this.notice as any).userUuid
    const user = this.roomManager?.data.userList.find(it => it.user.userUuid === userUuid)
    if (user) {
      await this.roomManager?.userService.acceptCoVideoApply(user.user)
      await this.roomManager?.userService.inviteStreamBy({
        roomUuid: this.roomUuid,
        streamUuid: user.streamUuid,
        userUuid: user.user.userUuid
      })
    }
  }

}