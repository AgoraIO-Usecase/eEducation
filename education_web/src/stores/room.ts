import { platform } from '@/utils/platform';
import { AgoraElectronClient } from '@/utils/agora-electron-client';
import { ChatMessage, AgoraStream } from '../utils/types';
import { Subject } from 'rxjs';
import { Map, Set, List } from 'immutable';
import AgoraRTMClient, { RoomMessage, CoVideoType } from '../utils/agora-rtm-client';
import { globalStore } from './global';
import {AgoraWebClient} from '../utils/agora-web-client';
import { get, set } from 'lodash';
import { isElectron } from '../utils/platform';
import GlobalStorage from '../utils/custom-storage';
import { t } from '../i18n';
import { CustomBtoa } from '@/utils/helper';
import { eduApi, UserAttrsParams } from '../services/edu-api';

export interface NotifyFlag {
  broad: boolean
}

export type LocalAttrs = Partial<AgoraUser & ClassState & {rawAccounts: any[]} & {broad: boolean}>;

export interface AgoraUser {
  uid: string
  account: string
  role: number
  video: number
  audio: number
  chat: number
  grantBoard: number
  userId: string // 仅用于服务端
  screenId: string //仅用于屏幕共享
}

export interface Me extends AgoraUser {
  rtmToken: string
  rtcToken: string
  channelName: string
  screenToken?: string
  appID: string
  coVideo: number
  uuid: string
}

export interface ClassState {
  rid: string
  roomName: string
  teacherId: string
  boardId: string // whiteboard_uuid
  boardToken: string // whiteboard_token
  // edu roomId
  // 房间id
  roomId: string

  // edu roomType
  // 房间类型
  roomType: number

  // lock board
  // 锁定
  lockBoard: number // lock_board

  // start class
  // 开始上课
  courseState: number
  // mute all chat
  // 全员禁言
  muteChat: number
  // recording 
  recordId: string
  recordingTime: number
  isRecording: boolean
  screenId: string
  screenToken: string
  coVideoUids: string[]
  memberCount: number
}

type RtcState = {
  published: boolean
  joined: boolean
  users: Set<number>
  shared: boolean
  localStream: AgoraMediaStream | null
  localSharedStream: AgoraMediaStream | null
  remoteStreams: Map<string, AgoraMediaStream>
}

export type MediaDeviceState = {
  microphoneId: string
  speakerId: string
  cameraId: string
  speakerVolume: number
  camera: number
  microphone: number
  speaker: number
}

export type SessionInfo = {
  uid: string
  rid: string
  account: string
  roomName: string
  roomType: number
  role: string
}

export type RtmState = {
  joined: boolean
}

export type UserParams = {
  userId: string,
  account: string,
}

export type RoomState = {
  rtmLock: boolean
  rtmToken: string
  recordLock: boolean
  rtcToken: string
  appID: string
  me: Me
  users: Map<string, AgoraUser>
  course: ClassState
  applyUser: UserParams
  rtc: RtcState
  rtm: RtmState
  mediaDevice: MediaDeviceState
  messages: List<ChatMessage>
  language: string
}

export type AgoraMediaStream = {
  streamID: number
  stream?: any
}

export class RoomStore {
  private subject: Subject<RoomState> | null;
  public _state: RoomState;

  get state() {
    return this._state;
  }

  set state(newState) {
    this._state = newState;
  }
  public readonly defaultState: RoomState = Object.freeze({
    rtmLock: false,
    rtcToken: '',
    rtmToken: '',
    appID: '',
    recordLock: false,
    me: {
      account: "",
      uid: "",
      roomToken: "",
      role: 0,
      video: 1,
      audio: 1,
      chat: 1,
      grantBoard: 0,
      rtmToken: '',
      rtcToken: '',
      appID: '',
      coVideo: '',
    },
    users: Map<string, AgoraUser>(),
    applyUser: {
      userId: '',
      account: '',
    },
    rtm: {
      joined: false,
    },
    rtc: {
      published: false,
      joined: false,
      shared: false,
      users: Set<number>(),
      localStream: null,
      localSharedStream: null,
      remoteStreams: Map<string, AgoraMediaStream>(),
    },
    course: {
      teacherId: '',
      boardId: '',
      boardToken: '',
      courseState: 0,
      muteChat: 0,
      isRecording: false,
      recordId: '',
      recordingTime: 0,
      rid: '',
      roomName: '',
      roomType: 0,
      lockBoard: 0,
      roomId: '',
      screenId: '',
      screenToken: '',

    },
    mediaDevice: {
      microphoneId: '',
      speakerId: '',
      cameraId: '',
      speakerVolume: 100,
      camera: 0,
      speaker: 0,
      microphone: 0
    },
    messages: List<ChatMessage>(),
    language: navigator.language,
    ...GlobalStorage.read('agora_room')
  });

  public windowId: number = 0;

  // public rtmClient: AgoraRTMClient = new AgoraRTMClient();
  // public rtcClient: AgoraWebClient | AgoraElectronClient = isElectron ? new AgoraElectronClient() : new AgoraWebClient();

  public rtmClient: AgoraRTMClient;
  public rtcClient: AgoraWebClient | AgoraElectronClient;

  constructor() {
    this.subject = null;
    this._state = {
      ...this.defaultState
    };
    this.rtmClient = new AgoraRTMClient();
    this.rtcClient = isElectron ? new AgoraElectronClient ({roomStore: this}) : new AgoraWebClient({roomStore: this});
  }

  initialize() {
    this.subject = new Subject<RoomState>();
    this.state = {
      ...this.defaultState,
    }
    this.subject.next(this.state);
  }

  subscribe(updateState: any) {
    this.initialize();
    this.subject && this.subject.subscribe(updateState);
  }

  unsubscribe() {
    this.subject && this.subject.unsubscribe();
    this.subject = null;
  }

  commit(state: RoomState) {
    this.subject && this.subject.next(state);
  }

  updateState(rootState: RoomState) {
    this.state = {
      ...this.state,
      ...rootState,
    }
    this.commit(this.state);
  }

  isTeacher(peerId: string) {
    if (!`${peerId}`
      || !`${this.state.course.teacherId}`
      || `${this.state.course.teacherId}` !== `${peerId}`
    ) return false;
    return true;
  }

  isStudent(peerId: string) {
    if (!`${peerId}`
      || `${this.state.course.teacherId}` === `${peerId}`
    ) return false;

    return true;
  }

  updateRecordState(params: RecordStateParams) {
    this.state = {
      ...this.state,
      course: {
        ...this.state.course,
        roomId: params.roomId,
        recordId: params.recordId,
        recordingTime: params.recordingTime,
        isRecording: !!params.isRecording,
      },
    }

    console.log(">>>: updateRecordState ", params)
    this.commit(this.state)
  }

  async fetchCurrentRoom() {
    try {
      const res = await eduApi.fetchRoomBy(roomStore.state.course.roomId);
      const {
        course,
        me,
        users: rawUsers,
        appID,
        onlineUsers
      } = res

      let users = rawUsers.reduce((acc: Map<string, AgoraUser>, it: any) => {
        return acc.set(`${it.uid}`, {
          role: it.role,
          account: it.userName,
          uid: it.uid,
          video: it.enableVideo,
          audio: it.enableAudio,
          chat: it.enableChat,
          grantBoard: it.grantBoard,
          userId: it.userId,
          screenId: it.screenId,
        });
      }, Map<string, AgoraUser>());

      await this.rtmClient.login(appID, `${me.uid}`, me.rtmToken)
      await this.rtmClient.join(course.rid)
      this.state = {
        ...this.state,
        rtm: {
          ...this.state.rtm,
          joined: true,
        },
        course: {
          ...this.state.course,
          rid: course.channelName,
          roomType: course.roomType,
          roomId: course.roomId,
          roomName: course.roomName,
          courseState: course.courseState,
          muteChat: course.muteAllChat,
          recordId: `${course.recordId}`,
          isRecording: course.isRecording,
          recordingTime: course.recordingTime,
          lockBoard: course.lockBoard,
          boardId: `${course.boardId}`,
          boardToken: `${course.boardToken}`,
          teacherId: `${course.teacherId}`,
          screenId: `${me.screenId}`,
          screenToken: `${me.screenToken}`,
          coVideoUids: course.coVideoUids,
          memberCount: +onlineUsers,
        },
        me: {
          ...this.state.me,
          uid: me.uid,
          account: me.userName,
          rtmToken: me.rtmToken,
          rtcToken: me.rtcToken,
          channelName: me.channelName,
          screenId: me.screenId,
          screenToken: me.screenToken,
          appID: me.appID,
          role: me.role,
          chat: me.enableChat,
          video: me.enableVideo,
          audio: me.enableAudio,
          userId: me.userId,
          coVideo: me.coVideo,
        },
        users,
        appID,
      }
      this.commit(this.state)
    } catch(err) {
      if (this.rtmClient._logged) {
        await this.rtmClient.logout();
      }
      throw err;
    }
  }

  addLocalStream(stream: AgoraStream) {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        localStream: stream
      }
    }
    this.commit(this.state);
  }

  removeLocalStream() {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        localStream: null,
        localSharedStream: null
      }
    }
    this.commit(this.state);
  }

  addLocalSharedStream(stream: any) {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        localSharedStream: stream
      }
    }
    this.commit(this.state);
  }

  removeLocalSharedStream() {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        localSharedStream: null
      }
    }
    this.commit(this.state);
  }

  addRTCUser(uid: number) {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        users: this.state.rtc.users.add(uid),
      }
    }
    this.commit(this.state);
  }

  removePeerUser(uid: number) {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        users: this.state.rtc.users.delete(uid),
      }
    }
    this.commit(this.state);
  }

  addRemoteStream(stream: AgoraStream) {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        remoteStreams: this.state.rtc.remoteStreams.set(`${stream.streamID}`, stream)
      }
    }
    this.commit(this.state);
  }

  removeRemoteStream(uid: number) {
    const remoteStream = this.state.rtc.remoteStreams.get(`${uid}`);
    if (platform === 'web') {
      if (remoteStream && remoteStream.stream && remoteStream.stream.isPlaying) {
        remoteStream.stream.isPlaying() && remoteStream.stream.stop();
      }
    }

    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        remoteStreams: this.state.rtc.remoteStreams.delete(`${uid}`)
      }
    }
    this.commit(this.state);
  }

  updateRtc(newState: any) {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        ...newState,
      }
    }
    this.commit(this.state);
  }

  updateDevice(state: MediaDeviceState) {
    this.state = {
      ...this.state,
      mediaDevice: state
    }
    this.commit(this.state);
  }

  async sendChannelMessage(args: any) {
    await eduApi.sendChannelMessage({
      roomId: this.state.course.roomId,
      message: args.message,
      type: 1,
    })
  }

  async handlePeerMessage(body: any, peerId: string) {
    const {cmd, data: {userName, userId, type}} = body
    if (cmd !== 1) return

    // student follow teacher peer message
    // 当对端是老师的时候
    // if (!this.isTeacher(myUid) && this.isTeacher(peerId)) {
    switch (type) {
      case CoVideoType.teacherSendReject: {
        globalStore.showToast({
          type: 'co-video',
          message: t("toast.teacher_reject_co_video")
        });
        return;
      }
      case CoVideoType.studentSendApply: {
        if (globalStore.state.notice.reason === 'peer_hands_up'
          && this.state.applyUser.userId) {
          // when notice is peer_hands_up, ignore peer message
          // 当已经收到消息以后屏蔽这条"举手申请"
          console.warn(`ignore: `, peerId, userId, type, userName)
          return
        }
        const applyUserId = userId

        if (applyUserId && peerId) {
          this.updateApplyUser({
            account: `${userName}`,
            userId: `${applyUserId}`,
          });
          globalStore.showNotice({
            reason: 'peer_hands_up',
            text: t('notice.student_interactive_apply', { reason: `${userName}` })
          });
          globalStore.showToast({
            type: 'peer_hands_up', 
            message: t('toast.student_send_co_video_apply', { reason: `${userName}` })
          });
          return
        }
      }
      case CoVideoType.teacherSendAccept: {
        globalStore.showToast({
          type: 'peer_hands_up',
          message: t('toast.teacher_accept_co_video', { reason: `${userName}` }),
        });
        return;
      }
      case CoVideoType.teacherSendStop: {
        globalStore.showToast({
          type: 'peer_hands_up',
          message: t('toast.stop_co_video', { reason: `${userName}` }),
        });
        return;
      }
    }
  }

  async mute(uid: string, type: string) {
    const me = this.state.me;
    if (`${me.uid}` === `${uid}`) {
      if (type === 'audio') {
        await this.updateLocalMe({
          audio: 0,
          broad: true
        });
      }
      if (type === 'video') {
        await this.updateLocalMe({
          video: 0,
          broad: true
        });
      }
      if (type === 'chat') {
        await this.updateLocalMe({
          chat: 0,
          broad: true
        });
      }
      // if (type === 'grantBoard') {
      //   await this.updateLocal({
      //     grantBoard: 0
      //   });
      // }
    }
    else if (me.role === 1) {
      if (type === 'audio') {
        await this.updateUserBy(`${uid}`, {audio: 0});
      }
      if (type === 'video') {
        await this.updateUserBy(`${uid}`, {video: 0});
      }
      if (type === 'chat') {
        await this.updateUserBy(`${uid}`, {chat: 0});
      }
      if (type === 'grantBoard') {
        await this.updateUserBy(`${uid}`, {grantBoard: 0});
      }
    }
  }

  async unmute(uid: string, type: string) {
    const me = this.state.me;
    if (`${me.uid}` === `${uid}`) {
      if (type === 'audio') {
        await this.updateLocalMe({
          audio: 1,
          broad: true
        });
      }
      if (type === 'video') {
        await this.updateLocalMe({
          video: 1,
          broad: true
        });
      }
      if (type === 'chat') {
        await this.updateLocalMe({
          chat: 1,
          broad: true
        });
      }
      // if (type === 'grantBoard') {
      //   await this.updateLocal({
      //     grantBoard: 1
      //   });
      // }
    }
    else if (me.role === 1) {
      if (type === 'audio') {
        await this.updateUserBy(`${uid}`, {audio: 1});
      }
      if (type === 'video') {
        await this.updateUserBy(`${uid}`, {video: 1});
      }
      if (type === 'chat') {
        await this.updateUserBy(`${uid}`, {chat: 1});
      }
      if (type === 'grantBoard') {
        await this.updateUserBy(`${uid}`, {grantBoard: 1});
      }
    }
  }

  async LoginToRoom(payload: any, pass: boolean = false) {
    const {userName, roomName, role, type, uuid} = payload
    try {
      const res = await eduApi.Login({
        userName,
        roomName,
        role,
        type,
        roomUuid: roomName,
        userUuid: uuid,
        enableVideo: 0,
        enableAudio: 1
      })

      const {
        course,
        me,
        users: rawUsers,
        appID,
        onlineUsers
      } = res

      let users = rawUsers.reduce((acc: Map<string, AgoraUser>, it: any) => {
        return acc.set(`${it.uid}`, {
          role: it.role,
          account: it.userName,
          uid: it.uid,
          video: it.enableVideo,
          audio: it.enableAudio,
          chat: it.enableChat,
          grantBoard: it.grantBoard,
          userId: it.userId,
          // coVideo: 1,
          screenId: it.screenId,
        });
      }, Map<string, AgoraUser>());

      await this.rtmClient.login(appID, `${me.uid}`, me.rtmToken)
      await this.rtmClient.join(course.rid)
      this.state = {
        ...this.state,
        rtm: {
          ...this.state.rtm,
          joined: true,
        },
        course: {
          ...this.state.course,
          rid: course.channelName,
          roomType: course.roomType,
          roomId: course.roomId,
          roomName: course.roomName,
          courseState: course.courseState,
          muteChat: course.muteAllChat,
          recordId: `${course.recordId}`,
          isRecording: course.isRecording,
          recordingTime: course.recordingTime,
          lockBoard: course.lockBoard,
          boardId: `${course.boardId}`,
          boardToken: `${course.boardToken}`,
          teacherId: `${course.teacherId}`,
          screenId: `${me.screenId}`,
          screenToken: `${me.screenToken}`,
          coVideoUids: course.coVideoUids,
          memberCount: +onlineUsers,
        },
        me: {
          ...this.state.me,
          uid: me.uid,
          account: me.userName,
          rtmToken: me.rtmToken,
          rtcToken: me.rtcToken,
          channelName: me.channelName,
          screenId: me.screenId,
          screenToken: me.screenToken,
          appID: me.appID,
          role: me.role,
          chat: me.enableChat,
          video: me.enableVideo,
          audio: me.enableAudio,
          userId: me.userId,
          coVideo: me.coVideo,
        },
        users,
        appID,
      }
      this.commit(this.state)
    } catch(err) {
      if (this.rtmClient._logged) {
        await this.rtmClient.logout();
      }
      throw err;
    }
  }

  setRTCJoined(joined: boolean) {
    this.state = {
      ...this.state,
      rtc: {
        ...this.state.rtc,
        joined
      }
    }
    this.commit(this.state);
  }

  updateChannelMessage(msg: ChatMessage) {
    this.state = {
      ...this.state,
      messages: this.state.messages.push(msg)
    };

    this.commit(this.state);
  }

  private compositeMe(params: Partial<Me>): Me {
    console.log("compositeMe: ", params);
    const newMe: Me = { ...this.state.me };
    for (const prop in params) {
      if (newMe.hasOwnProperty(prop) && params.hasOwnProperty(prop)) {
        set(newMe, prop, get(params, prop, ''));
      }
    }
    return newMe;
  }

  private compositeCourse(params: Partial<ClassState>): ClassState {
    console.log("compositeCourse: ", params);
    const newCourse = { ...this.state.course };
    for (const prop in params) {
      if (newCourse.hasOwnProperty(prop) && params.hasOwnProperty(prop)) {
        set(newCourse, prop, get(params, prop, ''));
      }
    }
    return newCourse;
  }

  async fetchCourse() {
    let course = await eduApi.getCourseState(this.state.course.roomId)
    return await this.updateCourse({...course, broad: false})
  }

  async fetchRoomState() {
    let {usersMap, room, me} = await eduApi.getRoomState(this.state.course.roomId)
    return await this.updateRoomState({usersMap, room, me, broad: false})
  }

  async updateRoomState(params: {usersMap: Map<string, AgoraUser>, room: Partial<ClassState>, me: Partial<Me>} & NotifyFlag) {
    const {usersMap, room, me} = params

    const teacherId = room.teacherId as string

    let coVideoUids = this.state.course.coVideoUids

    if (usersMap.count()) {
      const ids: any[] = []
      const usersJson = usersMap.toJSON()
      for (let key of Object.keys(usersJson)) {
        ids.push(`${key}`)
      }
      coVideoUids = ids.filter((id: string) => `${id}` !== `${teacherId}`)
    }

    const newMe = me

    this.state = {
      ...this.state,
      course: {
        ...this.state.course,
        ...room,
        coVideoUids,
      },
      me: {
        ...this.state.me,
        ...newMe
      },
      users: usersMap,
    }
    this.commit(this.state)
  }

  async updateLocalMe(params: Partial<Me & NotifyFlag>) {
    const {broad, ...meParams} = params
    const newMe = this.compositeMe(meParams)

    const newMeAttrs = {
      uid: newMe.uid,
      account: newMe.account,
      role: newMe.role,
      video: newMe.video,
      audio: newMe.audio,
      chat: newMe.chat,
      grantBoard: newMe.grantBoard,
      coVideo: newMe.coVideo,
      userId: newMe.userId,
      screenId: newMe.screenId,
    }

    const userAttrsParams: UserAttrsParams = {
      userId: newMeAttrs.userId as string,
      enableChat: newMeAttrs.chat as number,
      enableAudio: newMeAttrs.audio as number,
      enableVideo: newMeAttrs.video as number,
      grantBoard: newMeAttrs.grantBoard as number,
      // coVideo: newMeAttrs.coVideo as number
    }

    if (broad) {
      await this.updateRoomUser({user: userAttrsParams})
    }

    this.state = {
      ...this.state,
      me: {
        ...this.state.me,
        ...newMeAttrs,
      },
      users: this.state.users.set(`${this.state.me.uid}`, newMeAttrs)
    }
    this.commit(this.state)
  }

  async updateRoomUser({user}: {user: UserAttrsParams}) {
    return await eduApi.updateRoomUser(user)
  }

  updateApplyUser(user: any) {
    this.state = {
      ...this.state,
      applyUser: user
    }
    this.commit(this.state)
  }

  async updateUserBy(uid: string, params: Partial<AgoraUser & NotifyFlag>) {
    const {broad = true, ...userParams} = params
    const prevUser = this.state.users.get(`${uid}`)
    
    const newUserAttrs: Partial<AgoraUser> = {
      ...prevUser,
    }

    const userKeys = Object.keys(userParams)

    for (let key of userKeys) {
      if (newUserAttrs.hasOwnProperty(key)
        && userParams.hasOwnProperty(key)) {
        set(newUserAttrs, key, get(userParams, key))
      }
    }

    const userAttrsParams: UserAttrsParams = {
      userId: newUserAttrs.userId as string,
      enableChat: newUserAttrs.chat as number,
      enableAudio: newUserAttrs.audio as number,
      enableVideo: newUserAttrs.video as number,
      grantBoard: newUserAttrs.grantBoard as number,
      // coVideo: newUserAttrs.coVideo as number
    }

    if (broad) {
      await this.updateRoomUser({user: userAttrsParams})
    }

    this.state = {
      ...this.state,
      users: this.state.users.set(`${uid}`, newUserAttrs as AgoraUser)
    }
    this.commit(this.state)
  }

  resolveCourseAttrsToOperate(params: Partial<ClassState>): any {
    const keys = ['lockBoard', 'courseState', 'muteChat']
    for (let key of keys) {
      if (params.hasOwnProperty(key)) {
        let value = -1
        let stateValue = get(params, key, 0)
        let stateKey = key;
        if (key === 'lockBoard') {
          value = stateValue ? RoomMessage.lockBoard : RoomMessage.unlockBoard
        } else if (key === 'courseState') {
          value = stateValue ? RoomMessage.startCourse : RoomMessage.endCourse
        } else if (key === 'muteChat') {
          value = stateValue ? RoomMessage.muteAllChat : RoomMessage.unmuteAllChat
          stateKey = 'muteAllChat'
        }
        return {
          key: stateKey,
          stateValue,
          value
        }
      }
    }
  }

  async updateCourse(params: Partial<ClassState & NotifyFlag>) {
    const {broad = true, ...courseParams} = params

    const {key, stateValue}: any = this.resolveCourseAttrsToOperate(courseParams)

    if (broad) {
      await eduApi.updateCourse({
        room: {
          [`${key}`]: stateValue
        }
      })
      this.state = {
        ...this.state,
        course: {
          ...this.state.course,
          ...courseParams
        }
      }
      this.commit(this.state)
      return
    }
    this.state = {
      ...this.state,
      course: {
        ...this.state.course,
        ...courseParams
      }
    }
    this.commit(this.state)
  }

  async updateLocal(params: LocalAttrs) {
    const newMe = this.compositeMe(params)
    const newCourse = this.compositeCourse(params)
    const users = this.state.users

    this.state = {
      ...this.state,
      me: {
        ...newMe,
      },
      users,
      course: {
        ...newCourse,
      }
    }
    this.commit(this.state)
  }

  async exitRoom() {
    return await eduApi.exitRoom(this.state.course.roomId)
  }

  async exitAll() {
    try {
      try {
        await this.rtmClient.exit();
      } catch (err) {
        console.warn(err);
      }
      try {
        await this.rtcClient.exit();
      } catch (err) {
        console.warn(err);
      }
    } finally {
      GlobalStorage.clear('agora_room');
      this.state = {
        ...this.defaultState
      }
      this.commit(this.state);
    }
  }

  async startWebScreenShare() {
    const webClient = this.rtcClient as AgoraWebClient
    try {
      const {screenToken} = await eduApi.refreshToken();
      const {screenId, rid} = this.state.course
      const appId = this.state.appID
      await webClient.startScreenShare({
        uid: +screenId,
        token: screenToken,
        channel: rid,
        appId
      })
      // add screen client listener
      // 监听屏幕共享主要的事件
      webClient.shareClient.on('onTokenPrivilegeWillExpire', (evt: any) => {
        // WARN: IF YOU ENABLED APP CERTIFICATE, PLEASE SIGN YOUR TOKEN IN YOUR SERVER SIDE AND OBTAIN IT FROM YOUR OWN TRUSTED SERVER API
        const newToken = '';
        webClient.shareClient.renewToken(newToken);
      });
      webClient.shareClient.on('onTokenPrivilegeDidExpire', (evt: any) => {
        // WARN: IF YOU ENABLED APP CERTIFICATE, PLEASE SIGN YOUR TOKEN IN YOUR SERVER SIDE AND OBTAIN IT FROM YOUR OWN TRUSTED SERVER API
        const newToken = '';
        webClient.shareClient.renewToken(newToken);
      });
      webClient.shareClient.on('stopScreenSharing', (evt: any) => {
        console.log('stop screen share', evt);
        this.stopWebScreenShare().then(() => {
          globalStore.showToast({
            message: t('toast.canceled_screen_share'),
            type: 'notice'
          });
        }).catch(console.warn).finally(() => {
          console.log('[agora-web] stop share');
        })
      })
    } catch(err) {
      if (webClient.shareClient) {
        webClient.shareClient.off('onTokenPrivilegeWillExpire', (evt: any) => {})
        webClient.shareClient.off('onTokenPrivilegeDidExpire', (evt: any) => {})
        webClient.shareClient.off('stopScreenSharing', (evt: any) => {})
      }
      if (err.type === 'error' && err.msg === 'NotAllowedError') {
        globalStore.showToast({
          message: t('toast.canceled_screen_share'),
          type: 'notice'
        });
      }
      if (err.type === 'error' && err.msg === 'PERMISSION_DENIED') {
        globalStore.showToast({
          message: t('toast.screen_sharing_failed', {reason: err.msg}),
          type: 'notice'
        });
      }
      throw err
    }
  }

  async stopWebScreenShare() {
    const webClient = this.rtcClient as AgoraWebClient
    if (webClient.shared) {
      await webClient.stopScreenShare()
      this.removeLocalSharedStream();
    }
  }

  // WARN: only work in electron environment
  // 仅用于electron运行环境
  async startNativeScreenShare() {
    const rtcClient = this.rtcClient;
    globalStore.setNativeWindowInfo({
      visible: true,
      items: (rtcClient as AgoraElectronClient).getScreenShareWindows()
    })
  }

  async startScreenShare() {
    if (platform === 'electron') {
      await this.startNativeScreenShare()
    }

    if (platform === 'web') {
      await this.startWebScreenShare()
    }
  }

  async stopNativeScreenShare() {
    const nativeClient = this.rtcClient as AgoraElectronClient;
    await nativeClient.stopScreenShare();
  }

  async stopScreenShare() {
    if (platform === 'web') {
      await this.stopWebScreenShare()
    }

    if (platform === 'electron') {
      await this.stopNativeScreenShare()
    }
  }

  lockRecording() {
    if (!this.state) return
    this.state={
      ...this.state,
      recordLock: true
    }
    this.commit(this.state)
  }

  unlockRecording() {
    if (!this.state) return
    this.state={
      ...this.state,
      recordLock: false
    }
    this.commit(this.state)
  }
  
  async startRecording () {
    this.lockRecording()
    try {
      const maxIdleTime = 30
      const {data: recordId} = await eduApi.startRecording({
        recordingConfig: {
          maxIdleTime
        },
      })
      this.state = {
        ...this.state,
        course: {
          ...this.state.course,
          recordId,
          isRecording: true
        }
      }
      this.commit(this.state)
    } catch(err) {
      throw err;
    } finally {
      this.unlockRecording()
    }
  }

  async stopRecording () {
    this.lockRecording()
    try {
      await eduApi.stopRecording(this.state.course.recordId)
      const roomId = this.state.course.roomId
      const {data: roomInfo} = await eduApi.getRoomInfoBy(roomId)
      const recordId = roomInfo.room.recordId
      this.state = {
        ...this.state,
        course: {
          ...this.state.course,
          recordId: recordId,
          isRecording: false
        }
      }
      this.commit(this.state)
    } catch(err) {
      throw err
    } finally {
      this.unlockRecording()
    }
  }

  updateCoVideoUsers(rawUsers: any) {
    const coVideoUids: any[] = []
    let users = rawUsers.reduce((acc: Map<string, AgoraUser>, it: any) => {
      if (+it.role === 2) {
        coVideoUids.push(+it.uid)
      }
      
      return acc.set(`${it.uid}`, {
        role: it.role,
        account: it.userName,
        uid: it.uid,
        video: it.enableVideo,
        audio: it.enableAudio,
        chat: it.enableChat,
        grantBoard: it.grantBoard,
        userId: it.userId,
        screenId: it.screenId,
      });
    }, Map<string, AgoraUser>());

    let meState = this.state.me

    let newMe = users.find((user: AgoraUser) => +this.state.me.uid === +user.uid)

    if (newMe) {
      meState = this.compositeMe({...newMe, coVideo: 1})
    } else {
      meState = {
        ...meState,
        coVideo: 0
      }
    }

    let courseState: any = {
      screenId: this.state.course.screenId,
      teacherId: this.state.course.teacherId,
    }

    let newCourse = users.find((user: AgoraUser) => +user.role === 1)

    if (newCourse) {
      courseState.screenId = newCourse.screenId
      courseState.teacherId = newCourse.uid
    }

    let applyUser = this.state.applyUser;
    if (applyUser && applyUser.userId) {
      const foundUser = users.find((user: AgoraUser) => user.userId === applyUser.userId)
      if (!foundUser) {
        applyUser = {
          userId: '',
          account: ''
        }
      }
    }

    this.state = {
      ...this.state,
      users: users,
      me: {
        ...this.state.me,
        ...meState
      },
      course: {
        ...this.state.course,
        ...courseState,
        coVideoUids,
      },
      applyUser
    }
    this.commit(this.state)
  }

  updateRoomInfo(data: any) {
    this.state = {
      ...this.state,
      course: {
        ...this.state.course,
        lockBoard: data.lockBoard,
        muteChat: data.muteAllChat,
        courseState: data.courseState,
      }
    }
    this.commit(this.state)
  }

  updateRoomMember(memberCount: number) {
    this.state = {
      ...this.state,
      course: {
        ...this.state.course,
        memberCount
      }
    }
    this.commit(this.state)
  }

  updateScreenShare(payload: any) {
    this.state = {
      ...this.state,
      course: {
        ...this.state.course,
        screenId: payload.screenId,
      }
    }

    this.commit(this.state)
  }
}

export const roomStore = new RoomStore();

// TODO: Please remove it before release in production
// 备注：请在正式发布时删除操作的window属性
//@ts-ignore
window.roomStore = roomStore;