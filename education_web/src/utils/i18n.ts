import { globalStore } from './../stores/global';
import {get, isEmpty} from 'lodash';

const BUILD_VERSION = process.env.REACT_APP_BUILD_VERSION as string;
const build_version = BUILD_VERSION ? BUILD_VERSION : '0.0.1';

const zhCN: any = {
  'error': {
    'components': {
      'paramsEmpty': '参数：{reason}不能为空',
    }
  },
  'whiteboard': {
    'loading': '加载中...',
  },
  'toast': {
    'api_login_failured': '房间加入失败, 原因: {reason}',
    'confirm': '确定',
    'cancel': '取消',
    'quit_room': '确定退出课程吗？',
    'kick': '其他端登录，被踢出房间',
    'login_failure': '登录房间失败',
    'whiteboard_lock': '设置白板跟随',
    'whiteboard_unlock': '取消白板跟随',
    'canceled_screen_share': '已取消屏幕共享',
    'screen_sharing_failed': '屏幕分享失败, 原因：{reason}',
    'recording_failed': '开启云录制失败, 原因：{reason}',
    'start_recording': '开始云录制',
    'stop_recording': '结束云录制',
    'recording_too_short': '录制太短，至少15秒',
    'rtm_login_failed': '房间登录失败, 请检查网络设置',
    'rtm_login_failed_reason': '房间登录失败, 原因： {reason}',
    'replay_failed': '回放失败，请刷新页面重试',
    'teacher_exists': '该房间老师已存在，请等待30秒或重新创建教室',
    'student_over_limit': '超出学生最大人数，请等待30秒或重新创建教室',
    'teacher_and_student_over_limit': '超出学生和老师的最大人数',
    'teacher_accept_whiteboard': '老师已授权了你白板的权限',
    'teacher_cancel_whiteboard': '老师已收回了你白板的权限',
    'teacher_accept_co_video': '老师已允许连麦',
    'teacher_reject_co_video': '老师已拒绝连麦',
    'teacher_cancel_co_video': '老师已取消连麦',
    'student_cancel_co_video': '学生已取消连麦',
  },
  'notice': {
    'student_interactive_apply': `"{reason}"想和你连麦`
  },
  'chat': {
    'placeholder': '说点什么',
    'banned': '禁言中',
    'send': '发送'
  },
  'device': {
    'camera': '摄像头',
    'microphone': '麦克风',
    'speaker': '扬声器',
    'finish': '完成',
  },
  'nav': {
    'delay': '延迟: ',
    'network': '网络: ',
    'cpu': 'CPU: ',
    'class_end': '课程结束',
    'class_start': '课程开始'
  },
  'home': {
    'entry-home': '进入教室',
    'teacher': '老师',
    'student': '学生',
    'cover_class': 'cover-cn',
    'room_name': '房间名',
    'nickname': '昵称',
    'room_type': '房间类型',
    'room_join': '加入房间',
    'short_title': {
      'title': '声网在线教育解决方案',
      'subtitle': '由声网提供',
    },
    'name_too_long': '名字过长，不得超过20个字符',
    '1v1': '一对一',
    'mini_class': '小班课',
    'large_class': '大班课',
    'missing_room_name': '缺少房间名',
    'missing_your_name': '缺少昵称',
    'missing_password': '缺少房间密码',
    'missing_role': '缺少角色',
    'account': '姓名',
    'password': '密码',
  },
  'room': {
    'chat_room': '消息列表',
    'student_list': '学生列表',
    'uploading': '上传中...',
    'converting': '转换中...',
    'upload_success': '上传成功',
    'upload_failure': '上传失败，请检查网络',
    'convert_success': '转换成功',
    'convert_failure': '转换失败，请检查网络',
  },
  'replay': {
    'loading': '加载中...',
  },
  'build_version': `构建版本: ${build_version}`,
}

const en = {
  'error': {
    'components': {
      'paramsEmpty': 'params：{reason} can`t be empty',
    }
  },
  'whiteboard': {
    'loading': 'Loading...',
  },
  'toast': {
    'api_login_failured': 'Join Failured, Reason: {reason}',
    'confirm': 'Confirm',
    'cancel': 'Cancel',
    'quit_room': 'Are U sure to exit the classroom?',
    'kick': 'kicked',
    'login_failure': 'login failure',
    'whiteboard_lock': 'Whiteboard follow',
    'whiteboard_unlock': 'Whiteboard nofollow',
    'canceled_screen_share': 'Canceled screen sharing',
    'screen_sharing_failed': 'Screen sharing failed, reason: {reason}',
    'recording_failed': 'Start cloud recording failed, reason: {reason}',
    'start_recording': 'Start cloud recording success',
    'stop_recording': 'Stop cloud recording success',
    'recording_too_short': 'Recording too short, at least 15 seconds',
    'rtm_login_failed': 'login failure, please checkout ur network',
    'rtm_login_failed_reason': 'login failure, reason: {reason}',
    'replay_failed': 'Replay Failed please refresh browser',
    'teacher_exists': 'Teacher already exists, Please waiting for 30s or reopen new class',
    'student_over_limit': 'Student have reached upper limit, , Please waiting for 30s or rejoin new class',
    'teacher_and_student_over_limit': 'The number of students and teacher have reached upper limit',
    'teacher_accept_whiteboard': 'Teacher already grant your whiteboard',
    'teacher_cancel_whiteboard': 'Teacher already cancel your whiteboard',
    'teacher_accept_co_video': 'Teacher already accept co-video',
    'teacher_reject_co_video': 'Teacher already rejected co-video',
    'teacher_cancel_co_video': 'Teacher already canceled co-video',
    'student_cancel_co_video': 'Student canceled co-video',
  },
  'notice': {
    'student_interactive_apply': `"{reason}" wants to interact with you`
  },
  'chat': {
    'placeholder': 'Input Message',
    'banned': 'Banned',
    'send': 'send'
  },
  'device': {
    'camera': 'Camera',
    'microphone': 'Microphone',
    'speaker': 'Speaker',
    'finish': 'Finish',
  },
  'nav': {
    'delay': 'Delay: ',
    'network': 'Network: ',
    'cpu': 'CPU: ',
    'class_end': 'Class end',
    'class_start': 'Class start'
  },
  'home': {
    'entry-home': 'Enter in Home',
    'teacher': 'teacher',
    'student': 'student',
    'cover_class': 'cover-en',
    'room_name': 'Room Name',
    'nickname': 'Your Name',
    'room_type': 'Room Type',
    'room_join': 'Join',
    'short_title': {
      'title': 'Agora Education',
      'subtitle': 'Powered by agora.io',
    },
    'name_too_long': 'name too long, should <= 20 characters',
    '1v1': 'One-to-One',
    'mini_class': 'Small Class',
    'large_class': 'Large Class',
    'missing_room_name': 'missing room name',
    'missing_your_name': 'missing your name',
    'missing_password': 'missing password',
    'missing_role': 'missing role',
    'account': 'nickname',
    'password': 'password',
  },
  'room': {
    'chat_room': 'Chat Room',
    'student_list': 'Student List',
    'uploading': 'Uploading...',
    'converting': 'Converting...',
    'upload_success': 'upload success',
    'upload_failure': 'upload failure, check the network',
    'convert_success': 'convert success',
    'convert_failure': 'convert failure, check the network',
  },
  'replay': {
    'loading': 'loading...',
  },
  'build_version': `build version: ${build_version}`,
}

export const t = (name: string, options?: any): string => {
  const lang = globalStore.state.language.match(/zh/) ? zhCN : en;
  let content = get(lang, name, null);
  if (!content) throw `${lang}: ${name} has no match`;
  if (!isEmpty(options)) {
    if (options.reason && content.match(/\{.+\}/)) {
      content = content.replace(/\{.+\}/, options.reason);
    }
  }

  return content;
}