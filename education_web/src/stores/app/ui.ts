import { GlobalStorage } from '../../utils/custom-storage';
import { observable, action, computed } from 'mobx';
import { AppStore } from '.';
import { DialogMessage, DialogType } from '@/components/dialog';

const platform = process.env.REACT_APP_RUNTIME_PLATFORM as string;

interface NoticeMessage {
  type: string
  message: string
}


export class UIStore {

  static roomTypes: any[] = [
    {
      path: 'one-to-one',
      text: 'home.1v1',
      value: 0,
    },
    {
      path: 'small-class',
      text: 'home.mini_class',
      value: 1,
    },
    {
      path: 'big-class',
      text: 'home.large_class',
      value: 2,
    },
    {
      path: 'breakout-class',
      text: 'home.super_mini_class',
      value: 3,
    },
  ]

  static languages: any[] = [
    /* {
      text: '中文', name: 'zh-CN',
    }, */
    {
      text: 'En', name: 'en'
    }
  ]


  @observable
  loading?: boolean = false;

  @observable
  boardLoading?: boolean = false;

  @observable
  uploading?: boolean = false;

  @observable
  converting?: boolean = false;

  @observable
  notice?: NoticeMessage

  @observable
  dialog?: DialogMessage

  @observable
  settingDialog: boolean = false

  @observable
  toastQueue: string[] = []

  @action
  addToast(message: string) {
    this.toastQueue.push(message)
  }

  @action
  removeToast(message: string) {
    const idx = this.toastQueue.findIndex((it: any) => (it === message))
    if (idx !== -1) {
      this.toastQueue.splice(idx, 1)
    }
  }

  @observable
  autoplayToast: boolean = false

  @action
  showAutoplayNotification() {
    this.autoplayToast = true
  }

  @action
  removeAutoplayNotification() {
    this.autoplayToast = false
  }

  appStore!: AppStore

  constructor(appStore: AppStore) {
    this.appStore = appStore
  }

  get platform(): string {
    return platform;
  }

  get isElectron(): boolean {
    return this.platform === 'electron'
  }

  get isWeb(): boolean {
    return this.platform === 'web'
  }

  @action
  reset () {
    this.settingDialog = false
    this.loading = false;
    this.uploading = false;
    this.boardLoading = false;
    this.converting = false;
    this.notice = undefined;
    this.dialog = undefined;
    this.toastQueue = []
    this.autoplayToast = false
    this.dialogs = []
  }

  @action
  startLoading () {
    this.loading = true;
  }

  @action
  stopLoading() {
    this.loading = false;
  }

  @action
  startBoardLoading() {
    this.loading = false;
  }

  @action
  stopBoardLoading () {
    this.loading = true;
  }

  @action
  startConverting() {
    this.converting = true
  }
  
  @action
  stopConverting() {
    this.converting = false;
  }

  @action
  startUploading() {
    this.uploading = true
  }
  
  @action
  stopUploading() {
    this.uploading = false
  }

  @action
  showNotice (notice: NoticeMessage) {
    this.notice = notice
  }

  @action
  removeNotice () {
    this.notice = undefined
  }

  @observable
  dialogs: DialogType[] = []

  @action
  showDialog (dialog: DialogMessage) {
    this.addDialog(dialog)
  }

  @action
  addDialog (dialog: DialogMessage) {
    this.dialogs.push({dialog, id: this.dialogs.length})
  }

  @action
  removeDialog (id: number) {
    const idx = this.dialogs.findIndex(it => it.id === id)
    if (idx !== -1) {
      this.dialogs.splice(idx, 1)
    }
  }

  get ipc() {
    //@ts-ignore
    return window.ipc
  }

  windowMinimum() {
    if (this.isElectron && this.ipc) {
      this.ipc.send('minimum')
    }
  }

  windowMaximum() {
    if (this.isElectron && this.ipc) {
      this.ipc.send('maximum')
    }
  }

  windowClose() {
    if (this.isElectron && this.ipc) {
      this.ipc.send('close')
    }
  }

  @observable
  _language: string = GlobalStorage.getLanguage();

  @computed
  get language(): string {
    return this._language;
  }

  @action
  setLanguage(language: string) {
    this._language = language
    GlobalStorage.setLanguage(this._language)
  }

  hasDialog(type: string) {
    return this.dialogs.find(it => it.dialog.type === type)
  }

  @observable
  curSeqId: number = 0

  @action
  updateCurSeqId(v: number) {
    this.curSeqId = v
  }

  @observable
  lastSeqId: number = 0

  updateLastSeqId(v: number) {
    this.lastSeqId = v
  }
}