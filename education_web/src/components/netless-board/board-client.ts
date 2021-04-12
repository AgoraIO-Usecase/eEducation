import { EventEmitter } from 'events';
import { Room, WhiteWebSdk, DeviceType, createPlugins, Plugins, JoinRoomParams, Player, ReplayRoomParams, ViewMode, ScreenType } from 'white-web-sdk';
import { videoPlugin } from '@netless/white-video-plugin';
import { audioPlugin } from '@netless/white-audio-plugin';
import { get } from 'lodash';


const appIdentifier = process.env.REACT_APP_NETLESS_APP_ID as string

export class BoardClient extends EventEmitter {
  client!: WhiteWebSdk;
  plugins?: Plugins<Object>;
  room!: Room;
  player!: Player;
  sceneIndex: number = 0;

  disconnected?: boolean = true
  

  constructor(config: {identity: string} = {identity: 'guest'}) {
    super()
    this.initPlugins(config.identity)
    this.init()
    
  }
  

  initPlugins (identity: string) {
    const plugins = createPlugins({"video": videoPlugin, "audio": audioPlugin });

    plugins.setPluginContext("video", {identity});
    plugins.setPluginContext("audio", {identity});    
    this.plugins = plugins;
  }

  init () {
    this.client = new WhiteWebSdk({
      deviceType: DeviceType.Surface,
      plugins: this.plugins,
      appIdentifier: appIdentifier,
      loggerOptions: {
        disableReportLog: true,
        reportLevelMask: "debug",
        printLevelMask: "debug",
      }
      
    })
    this.disconnected = true
    
  }

  async join(params: JoinRoomParams) {
    console.log('[breakout board] before board client join', params)
    this.room = await this.client.joinRoom(params, {
      onPhaseChanged: phase => {
        this.emit('onPhaseChanged', phase);
      },
      onRoomStateChanged: state => {
        this.emit('onRoomStateChanged', state)
      },
      onDisconnectWithError: error => {
        this.emit('onDisconnectWithError', error)
      },
      onKickedWithReason: reason => {
        this.emit('onKickedWithReason', reason)
      },
      onKeyDown: event => {
        this.emit('onKeyDown', event)
      },
      onKeyUp: event => {
        this.emit('onKeyUp', event)
      },
      onHandToolActive: active => {
        this.emit('onHandToolActive', active)
      },
      onPPTLoadProgress: (uuid: string, progress: number) => {
        this.emit('onPPTLoadProgress', {uuid, progress})
      },
    })
    console.log('[breakout board] board client join')
    this.disconnected = false
  }

  async replay(params: ReplayRoomParams) {
    this.player = await this.client.replayRoom(params, {
      onPhaseChanged: phase => {
        this.emit('onPhaseChanged', phase)
      },
      onLoadFirstFrame: () => {
        console.log('onLoadFirstFrame')
        this.emit('onLoadFirstFrame')
      },
      onSliceChanged: () => {
        console.log('onSliceChanged')
        this.emit('onSliceChanged')
      },
      onPlayerStateChanged: (error) => {
        this.emit('onPlayerStateChanged', error)
      },
      onStoppedWithError: (error) => {
        this.emit('onStoppedWithError', error)
      },
      onProgressTimeChanged: (scheduleTime) => {
        this.emit('onProgressTimeChanged', scheduleTime)
      }
    })
  }

  followMode() {
    if (this.room && !this.disconnected) {
      this.room.setViewMode(ViewMode.Broadcaster)
    }
  }

  startFollow() {
    if (this.room && !this.disconnected) {
      this.room.setGlobalState({
        follow: 1
      })
      console.log('[board] set start follow')
    }
  }

  cancelFollow() {
    if (this.room && !this.disconnected) {
      this.room.setGlobalState({
        follow: 0
      })
      console.log('[board] set cancel follow')
    }
  }

  grantPermission(userUuid: string) {
    if (this.room && !this.disconnected) {
      const grantUsers = get(this.room.state.globalState, 'grantUsers', [])
      if (!grantUsers.find((it: string) => it === userUuid)) {
        grantUsers.push(userUuid)
        this.room.setGlobalState({
          grantUsers: grantUsers
        })
        console.log('[board] grantUsers ', JSON.stringify(grantUsers))
      }
    }
  }

  revokePermission(userUuid: string) {
    if (this.room && !this.disconnected) {
      const grantUsers = get(this.room.state.globalState, 'grantUsers', [])
      let index = grantUsers.findIndex((it: string) => it === userUuid)
      if (index !== -1) {
        grantUsers.splice(index, 1)
        this.room.setGlobalState({
          grantUsers: grantUsers
        })
        console.log('[board] grantUsers ', JSON.stringify(grantUsers))
      }
    }
  }

  async destroy() {
    if (this.room && !this.disconnected) {
      await this.room.disconnect()
      this.disconnected = true
    }
  }

  showStepapp() {
    if (this.room && !this.disconnected) {
      this.room.setGlobalState({
        showStepapp: 1
      })
    }
  }

  hideStepapp() {
    if (this.room && !this.disconnected) {
      this.room.setGlobalState({
        showStepapp: 0
      })
    }
  }

}