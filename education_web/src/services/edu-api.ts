import { BUILD_VERSION, t } from './../i18n';
import { AgoraFetch } from "../utils/fetch";
import { ClassState, AgoraUser, Me } from "../stores/room";
import {Map} from 'immutable'
import {get} from 'lodash'
import { getIntlError, setIntlError } from "./intl-error-helper";
import { globalStore } from "../stores/global";
import { historyStore } from './../stores/history';
import OSS from "ali-oss";
import axios from 'axios';
 /* eslint-disable */ 
import Log from '../utils/LogUploader';

const whiteboardGenerateTokenApiEndpoint = process.env.REACT_APP_YOUR_BACKEND_WHITEBOARD_API as string;

export interface UserAttrsParams {
  userId: string
  enableChat: number
  enableVideo: number
  enableAudio: number
  grantBoard: number
  // coVideo?: number
}

const APP_ID: string = process.env.REACT_APP_AGORA_APP_ID as string;
const PREFIX: string = process.env.REACT_APP_AGORA_EDU_ENDPOINT_PREFIX as string;
const AUTHORIZATION: string = process.env.REACT_APP_AGORA_RESTFULL_TOKEN as string;

const AgoraFetchJson = async ({url, method, data, token, full_url}:{url?: string, method: string, data?: any, token?: string, full_url?: string}) => {  
  const opts: any = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${AUTHORIZATION!.replace(/basic\s+|basic/i, '')}`
    }
  }

  if (token) {
    opts.headers['token'] = token;
  }
  if (data) {
    opts.body = JSON.stringify(data);
  }

  let resp = undefined;
  if (full_url) {
    resp = await AgoraFetch(`${full_url}`, opts);
  } else {
    resp = await AgoraFetch(`${PREFIX}${url}`, opts);
  }
  const {code, msg, data: responseData} = resp

  if (code !== 0 && code !== 408) {
    const error = getIntlError(`${code}`)
    const isErrorCode = `${error}` === `${code}`
    globalStore.showToast({
      type: 'eduApiError',
      message: isErrorCode ? `${msg}` : error
    })
    if (code === 401 || code === 1101012) {
      // historyStore.state.history.goBack()
      historyStore.state.history.push('/')
      return
    }
    throw {api_error: error, isErrorCode}
  }

  return responseData
}

export interface EntryParams {
  userName: string
  roomName: string
  roomUuid: string
  userUuid: string
  type: number
  role: number
  enableVideo: number
  enableAudio: number
}

export type RoomParams = Partial<{
  muteAllChat: boolean
  lockBoard: number
  courseState: number
  [key: string]: any
}>

type FileParams = {
  file: any,
  key: string,
  host: string,
  policy: any,
  signature: any,
  callback: any,
  accessid: string
}

const uploadLogToOSS = async ({
  file,
  key,
  host,
  policy,
  signature,
  callback,
  accessid
}: FileParams) => {
  const formData = new FormData()
  formData.append('name', 'test.log')
  formData.append('key', key)
  formData.append('file', file)
  formData.append('policy',policy)
  formData.append('OSSAccessKeyId',accessid)
  formData.append('success_action_status','200')
  formData.append('callback',callback)
  formData.append('signature',encodeURIComponent(signature).replace(/%20/g,'+'))
  return await axios.post(host, formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded'}
  })
}

export class AgoraEduApi {

  appID: string = APP_ID;
  roomId: string = '';
  public _userToken: string = '';

  public get userToken(): string {
    const userToken = window.sessionStorage.getItem("edu-userToken") as string || '';
    return userToken;
  }

  public set userToken(token: string) {
    window.sessionStorage.setItem("edu-userToken", token)
  }
  
  recordId: string = '';

  // fetch stsToken
  // 获取 stsToken
  async fetchStsToken(roomId: string, fileExt: string) {
    // NOTE: demo feedback only
    const appCode = 'edu-demo'
    const _roomId = roomId ? roomId : 0;
    let data = await AgoraFetchJson({
      url: `/v1/log/params?appCode=${appCode}&osType=${3}&terminalType=${3}&appVersion=${BUILD_VERSION}&roomId=${_roomId}&fileExt=${fileExt}&appId=${this.appID}`,
      method: 'GET',
    })

    return {
      bucketName: data.bucketName as string,
      callbackBody: data.callbackBody as string,
      callbackContentType: data.callbackContentType as string,
      accessKeyId: data.accessKeyId as string,
      accessKeySecret: data.accessKeySecret as string,
      securityToken: data.securityToken as string,
      ossKey: data.ossKey as string,
    }
  }

  async uploadToOss(roomId: string, file: any, ext: string) {
    let {
      bucketName,
      callbackBody,
      callbackContentType,
      accessKeyId,
      accessKeySecret,
      securityToken,
      ossKey
    } = await this.fetchStsToken(roomId, ext);
    const ossParams = {
      bucketName,
      callbackBody,
      callbackContentType,
      accessKeyId,
      accessKeySecret,
      securityToken,
    }
    const ossClient = new OSS({
      accessKeyId: ossParams.accessKeyId,
      accessKeySecret: ossParams.accessKeySecret,
      stsToken: ossParams.securityToken,
      bucket: ossParams.bucketName,
      secure: true,
      // TODO: 请传递你自己的oss endpoint
      // TODO: Please use your own oss endpoint
      endpoint: 'oss-accelerate.aliyuncs.com',
    })

    const url = `${PREFIX}/v1/log/sts/callback`
    try {
      return await ossClient.put(ossKey, file, {
        callback: {
          url: `${PREFIX}/v1/log/sts/callback`,
          body: callbackBody,
          contentType: callbackContentType,
        }
      });
    } catch(err) {
      globalStore.showToast({
        type: 'oss',
        message: t("toast.upload_log_failure", {reason: err.name})
      })
      throw err
    }
  }

  async uploadZipLogFile(
    roomId: string,
    file: any
  ) {
    const res = await this.uploadToOss(roomId, file, 'zip')
    return res;
  }

  // upload log
  async uploadLogFile(
    roomId: string,
    file: any
  ) {
    const res = await this.uploadToOss(roomId, file, 'log')
    return res;
  }

  // fetch i18n
  static async fetchI18n() {
    let data = await AgoraFetchJson({
      url: `/v1/multi/language`,
      method: 'GET',
    });

    setIntlError(data || {})
  }

  // app config
  // 配置入口
  // async config() {
  //   let data = await AgoraFetchJson({
  //     url: `/v1/config?platform=0&device=0&version=5.2.0`,
  //     method: 'GET',
  //   });

  //   if (data['multiLanguage']) {
  //     setIntlError(data['multiLanguage'])
  //   }

  //   return {
  //     appId: data.appId,
  //     room: data.room,
  //   }
  // }

  // room entry
  // 房间入口
  async entry(params: EntryParams) {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/entry`,
      method: 'POST',
      data: params,
    });
    
    this.roomId = data.roomId;
    this.userToken = data.userToken;
    return {
      data
    }
  }

  // refresh token
  // 刷新token 
  async refreshToken() {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${this.roomId}/token/refresh`,
      method: 'POST',
      token: this.userToken,
    });
    return {
      rtcToken: data.rtcToken,
      rtmToken: data.rtmToken,
      screenToken: data.screenToken
    }
  }

  // update course
  // 更新课程状态
  async updateCourse(params: Partial<RoomParams>) {
    const {room} = params
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${this.roomId}`,
      method: 'POST',
      data: room,
      token: this.userToken,
    });
    return {
      data,
    }
  }

  // updateRoomUser
  // 更新用户状态，老师可更新房间内所有人，学生只能更新自己
  async updateRoomUser(user: Partial<UserAttrsParams>) {
    const {userId, ...userAttrs} = user
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${this.roomId}/user/${userId}`,
      method: 'POST',
      data: userAttrs,
      token: this.userToken,
    });
    return {
      data,
    }
  }

  // start recording
  // 开始录制
  async startRecording(config: RecordingConfig) {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${this.roomId}/record/start`,
      method: 'POST',
      data: config,
      token: this.userToken,
    });
    this.recordId = data.recordId
    return {
      data
    }
  }

  // stop recording
  // 结束录制
  async stopRecording(recordId: string) {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${this.roomId}/record/${recordId}/stop`,
      method: 'POST',
      token: this.userToken,
    })
    return {
      data
    }
  }

  // get recording list
  // 获取录制列表
  async getRecordingList () {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${this.roomId}/records`,
      method: 'GET',
      token: this.userToken,
    })
    return {
      data
    }
  }

  // get whiteboard token
  async getWhiteboardBy(roomId: string): Promise<any> {
    let boardData = await AgoraFetchJson({
      full_url: whiteboardGenerateTokenApiEndpoint.replace("%app_id%", this.appID).replace("%room_id%", roomId),
      method: 'GET',
      token: this.userToken,
    })
    return {
      boardId: boardData.boardId,
      boardToken: boardData.boardToken,
    };
  }

  // get room info
  // 获取房间信息
  async getRoomInfoBy(roomId: string): Promise<{data: any}> {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${roomId}`,
      method: 'GET',
      token: this.userToken,
    });
    let boardData = await this.getWhiteboardBy(roomId);
    return {
      data: {
        room: {
          ...data.room,
          boardId: boardData.boardId,
          boardToken: boardData.boardToken,
        },
        users: data.room.coVideoUsers,
        user: data.user
      }
    }
  }

  // getRoomState
  // 获取用户状态
  async getRoomState(roomId: string): Promise<{usersMap: Map<string, AgoraUser>, room: Partial<ClassState>, me: Partial<Me>}> {
    const {data} = await this.getRoomInfoBy(roomId)
    const {users: rawUsers, room: rawCourse, user: me} = data

    let usersMap: Map<string, AgoraUser> = rawUsers.reduce((acc: Map<string, AgoraUser>, it: any) => {
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

    const room: Partial<ClassState> = {
      courseState: rawCourse.courseState,
      muteChat: rawCourse.muteAllChat,
      isRecording: rawCourse.isRecording,
      boardId: rawCourse.boardId,
      boardToken: rawCourse.boardToken,
      lockBoard: rawCourse.lockBoard,
      teacherId: '',
      memberCount: rawCourse.onlineUsers,
    }

    const teacher = usersMap.find((it: AgoraUser) => it.role === 1)

    if (teacher) {
      room.teacherId = teacher.uid
    }
    
    if (me.role === 1) {
      room.teacherId = me.uid
    }

    return {
      usersMap,
      room,
      me
    }
  }

  // getCourseState
  // 获取房间状态
  async getCourseState(roomId: string): Promise<Partial<ClassState>> {
    const {data} = await this.getRoomInfoBy(roomId)
    const {users, room} = data

    const result: Partial<ClassState> = {
      roomName: room.roomName,
      roomId: room.roomId,
      courseState: room.courseState,
      roomType: room.type,
      muteChat: room.muteAllChat,
      recordId: room.recordId,
      recordingTime: room.recordingTime,
      isRecording: Boolean(room.isRecording),
      boardId: room.boardId,
      boardToken: room.boardToken,
      lockBoard: room.lockBoard,
      memberCount: room.onlineUsers,
    }

    const teacher = users.find((it: any) => it.role === 1)
    if (teacher) {
      result.teacherId = teacher.uid
      result.screenId = teacher.screenId
      result.screenToken = teacher.screenToken
    }

    return result
  }

  // login 登录教室
  async Login(params: EntryParams) {
    if (!this.appID) throw `appId is empty: ${this.appID}`
    let {data: {roomId, userToken}} = await this.entry(params)

    const {data: {room, user, users: userList = []}} = await this.getRoomInfoBy(roomId)

    const me = user

    const teacherState = userList.find((user: any) => +user.role === 1)

    const course: any = {
      rid: room.channelName,
      roomName: room.roomName,
      channelName: room.channelName,
      roomId: room.roomId,
      roomType: room.type,
      courseState: room.courseState,
      muteAllChat: room.muteAllChat,
      isRecording: room.isRecording,
      recordId: room.recordId,
      recordingTime: room.recordingTime,
      boardId: room.boardId,
      boardToken: room.boardToken,
      lockBoard: room.lockBoard,
      teacherId: 0
    }

    if (teacherState) {
      course.teacherId = +teacherState.uid
    }

    if (me.role === 1) {
      course.teacherId = me.uid
    }

    if (params.userUuid) {
      me.uuid = params.userUuid
    }

    const coVideoUids = userList.map((it: any) => `${it.uid}`)

    if (course.teacherId && coVideoUids.length) {
      course.coVideoUids = coVideoUids.filter((uid: any) => `${uid}` !== `${course.teacherId}`)
    }

    const result = {
      course,
      me,
      users: userList,
      appID: this.appID,
      onlineUsers: room.onlineUsers,
    }

    return result
  }

  async fetchRoomBy(roomId: string) {
    if (!this.appID) throw `appId is empty: ${this.appID}`
    this.roomId = roomId;
    const {data: {room, user, users: userList = []}} = await this.getRoomInfoBy(roomId)

    const me = user

    const teacherState = userList.find((user: any) => +user.role === 1)

    const course: any = {
      rid: room.channelName,
      roomName: room.roomName,
      channelName: room.channelName,
      roomId: room.roomId,
      roomType: room.type,
      courseState: room.courseState,
      muteAllChat: room.muteAllChat,
      isRecording: room.isRecording,
      recordId: room.recordId,
      recordingTime: room.recordingTime,
      boardId: room.boardId,
      boardToken: room.boardToken,
      lockBoard: room.lockBoard,
      teacherId: 0
    }

    if (teacherState) {
      course.teacherId = +teacherState.uid
    }

    if (me.role === 1) {
      course.teacherId = me.uid
    }

    const coVideoUids = userList.map((it: any) => `${it.uid}`)

    if (course.teacherId && coVideoUids.length) {
      course.coVideoUids = coVideoUids.filter((uid: any) => `${uid}` !== `${course.teacherId}`)
    }

    const result = {
      course,
      me,
      users: userList,
      appID: this.appID,
      onlineUsers: room.onlineUsers,
    }

    return result;
  }

  async getCourseRecordBy(recordId: string, roomId: string, token: string) {
    this.userToken = token
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${roomId}/record/${recordId}`,
      method: 'GET',
      token: this.userToken,
    });

    const boardData = await this.getWhiteboardBy(roomId);
    const teacherRecord = get(data, 'recordDetails', []).find((it:any) => it.role === 1)

    const recordStatus = [
      'recording',
      'finished',
      'finished_recording_to_be_download',
      'finished_download_to_be_convert',
      'finished_convert_to_be_upload'
    ]

    const result = {
      boardId: boardData.boardId,
      boardToken: boardData.boardToken,
      startTime: data.startTime,
      endTime: data.endTime,
      url: teacherRecord?.url,
      status: data.status,
      statusText: recordStatus[data.status],
    }
    return result
  }

  async exitRoom(roomId: string) {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${roomId}/exit`,
      method: 'POST',
      token: this.userToken,
      data: {
        appId: this.appID,
        roomId: roomId
      }
    })
    return
  }

  // NOTE: student send apply
  // NOTE: 学生发起连麦申请
  async studentSendApply(roomId: string) {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${roomId}/covideo`,
      method: 'POST',
      token: this.userToken,
      data: {
        type: 1
      }
    })
    return data;
  }

  // NOTE: student stop apply
  // NOTE: 学生主动取消连麦申请
  async studentStopCoVideo(roomId: string) {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${roomId}/covideo`,
      method: 'POST',
      token: this.userToken,
      data: {
        type: 6,
      }
    })
    return data;
  }

  // NOTE: teacher accept apply
  // NOTE: 教师同意学生申请
  async teacherAcceptApply(roomId: string, userId: string) {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${roomId}/covideo`,
      method: 'POST',
      token: this.userToken,
      data: {
        type: 4,
        userIds: [userId],
        enableVideo: 0,
        enableAudio: 1,
      }
    })
    return data;
  }

  // NOTE: teacher reject apply
  // NOTE: 教师拒绝学生连麦
  async teacherRejectApply(roomId: string, userId: string) {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${roomId}/covideo`,
      method: 'POST',
      token: this.userToken,
      data: {
        type: 2,
        userIds: [userId]
      }
    })
    return data;
  }

  // NOTE: teacher cancel apply
  // NOTE: 教师取消学生连麦
  async teacherCancelStudent(roomId: string, userId: string) {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${roomId}/covideo`,
      method: 'POST',
      token: this.userToken,
      data: {
        type: 5,
        userIds: [userId]
      }
    })
    return data;
  }

  // NOTE: send channel message
  // NOTE: 发送聊天消息
  async sendChannelMessage(payload: any) {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${payload.roomId}/chat`,
      method: 'POST',
      token: this.userToken,
      data: {
        message: payload.message,
        type: payload.type
      }
    })

    return data;
  }

  async startScreenShare(roomId: string) {
    let data = await AgoraFetchJson({
      url: `/v1/apps/${this.appID}/room/${roomId}/screen`,
      method: 'POST',
      token: this.userToken,
      data: {
        state: 1
      }
    })
    return data;
  }
}

export const eduApi = new AgoraEduApi();

export const fetchI18n = async () => {
  await AgoraEduApi.fetchI18n();
}
