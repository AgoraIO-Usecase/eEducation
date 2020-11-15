import React, { useState } from 'react';
import { useParams } from "react-router";
import { Theme, FormControl, Tooltip } from '@material-ui/core';
import {makeStyles} from '@material-ui/core/styles';
import {CustomButton} from '@/components/custom-button';
import { RoleRadio } from '@/components/role-radio';
import {CustomIcon} from '@/components/icon';
import {FormInput} from '@/components/form-input';
import {FormSelect} from '@/components/form-select';
import {LangSelect} from '@/components/lang-select';
import {useHistory} from 'react-router-dom';
import {GithubIcon} from '@/components/github-icon';
import { t } from '../i18n';
import { useUIStore, useRoomStore, useAppStore } from '@/hooks';
import { UIStore } from '@/stores/app';
import { GlobalStorage } from '@/utils/custom-storage';
import { EduManager } from '@/sdk/education/manager';
import {isElectron} from '@/utils/platform';

const useStyles = makeStyles ((theme: Theme) => ({
  formControl: {
    minWidth: '240px',
    maxWidth: '240px',
  }
}));

type SessionInfo = {
  roomName: string
  roomType: number
  userName: string
  role: string
}

const roomTypes = isElectron ?  UIStore.roomTypes.filter((it: any) => it.value !== 3) : UIStore.roomTypes


function HomePage() {
  document.title = t(`home.short_title.title`)

  const classes = useStyles();

  const history = useHistory();

  const uiStore = useUIStore();

  const appStore = useAppStore();
let { roomName,roomType,userType }  = useParams<any>();
const defaultState: SessionInfo = {
  roomName: roomName,
  roomType: roomType,
  role:userType,
  userName: '',
}

  const handleSetting = (evt: any) => {
    history.push({pathname: '/setting'})
  }

  const [lock, setLock] = useState<boolean>(false);

  const handleUpload = async (evt: any) => {
    try {
      setLock(true)
      const id = await EduManager.uploadLog('0')
      uiStore.showDialog({
        type: 'feedLog',
        message: `id: ${id}`
      })
      setLock(false)
    } catch (err) {
      uiStore.addToast(t('upload_log_failed'))
      setLock(false)
    }
  }

  const [session, setSessionInfo] = useState<SessionInfo>(defaultState);

  const [required, setRequired] = useState<any>({} as any);

  const handleSubmit = () => {
    if (!session.roomName) {
      setRequired({...required, roomName: t('home.missing_room_name')});
      return;
    }

    if (!session.userName) {
      setRequired({...required, userName: t('home.missing_your_name')});
      return;
    }

    if (!session.role) {
      setRequired({...required, role: t('home.missing_role')});
      return;
    }
    
    if (!roomTypes[session.roomType]) return;
    appStore.setRoomInfo({
      ...session,
      roomType: roomTypes[session.roomType].value
    })
    const path = roomTypes[session.roomType].path

    if (session.role === 'assistant') {
      history.push(`/breakout-class/assistant/courses`)
    } else {
      history.push(`/classroom/${path}`)
    }
      // history.push(`/classroom/${path}`)
  }

  return (
    <div className={`flex-container ${uiStore.isElectron ? 'draggable' : 'home-cover-web' }`}>
      {uiStore.isElectron ? null : 
      <div className="web-menu">
        <div className="web-menu-container">
          <div className="short-title">
            <span className="title">{t('home.short_title.title')}</span>
            <span className="subtitle">{t('home.short_title.subtitle')}</span>
            <span className="build-version">{t("build_version")}</span>
          </div>
          <div className="setting-container">
            <div className="flex-row">
              <Tooltip title={t("icon.upload-log")} placement="top">
                <span>
                  <CustomIcon className={lock ? "icon-loading" : "icon-upload"} onClick={handleUpload}></CustomIcon>
                </span>
              </Tooltip>
              <Tooltip title={t("icon.setting")} placement="top">
                <span>
                  <CustomIcon className="icon-setting" onClick={handleSetting}/>
                </span>
              </Tooltip>
            </div>
              <LangSelect
                value={uiStore.language.match(/^zh/) ? 0 : 1}
                onChange={(evt: any) => {
                  const value = evt.target.value;
                  window.location.reload()
                  if (value === 0) {
                    uiStore.setLanguage('zh-CN');
                  } else {
                    uiStore.setLanguage('en');
                  }
                }}
                items={UIStore.languages}>
              </LangSelect>
          </div>
        </div>
      </div>
      }
      <div className="custom-card">
        {!uiStore.isElectron ? <GithubIcon /> : null}
        <div className="flex-item cover">
          {uiStore.isElectron ? 
          <>
          <div className={`short-title ${GlobalStorage.getLanguage()}`}>
            <span className="title">{t('home.short_title.title')}</span>
            <span className="subtitle">{t('home.short_title.subtitle')}</span>
          </div>
          <div className={`cover-placeholder ${t('home.cover_class')}`}></div>
          <div className='build-version'>{t("build_version")}</div>
          </>
          : <div className={`cover-placeholder-web ${t('home.cover_class')}`}></div>
          }
        </div>
        <div className="flex-item card">
          <div className="position-top card-menu">
            {uiStore.isElectron && 
            <>
                <Tooltip title={t("icon.setting")} placement="bottom">
                  <span>
                    <CustomIcon className="icon-setting" onClick={handleSetting}/>
                  </span>
                </Tooltip>
                <div className="icon-container">
                  <CustomIcon className="icon-minimum" onClick={() => {
                    uiStore.windowMinimum()
                  }}/>
                  <CustomIcon className="icon-close" onClick={() => {
                    uiStore.windowClose()
                  }}/>
                </div>
            </>
            }
          </div>
          <div className="position-content flex-direction-column">
            <FormControl className={classes.formControl}>
              <FormInput
                alphabetical={true}
                Label={t('home.room_name')}
                value={session.roomName}
                onChange={
                  (val: string) => {
                    setSessionInfo({
                      ...session,
                      roomName: val
                    });
                  }
                }
                requiredText={required.roomName}
              />
            </FormControl>
            <FormControl className={classes.formControl}>
              <FormInput
                alphabetical={true}
                Label={t('home.nickname')}
                value={session.userName}
                onChange={(val: string) => {
                  setSessionInfo({
                    ...session,
                    userName: val
                  });
                }}
                requiredText={required.userName}
              />
            </FormControl>
            <FormControl className={classes.formControl}>
              <FormSelect 
                Label={t('home.room_type')}
                value={session.roomType}
                onChange={(evt: any) => {
                  setSessionInfo({
                    ...session,
                    roomType: evt.target.value
                  });
                }}
                items={roomTypes
                  .map((it: any) => ({
                  value: it.value,
                  text: t(`${it.text}`),
                  path: it.path
                }))}
              />
            </FormControl>
            <FormControl className={classes.formControl}>
              <RoleRadio value={session.role}  type={session.roomType} onChange={(evt: any) => {
                 setSessionInfo({
                   ...session,
                   role: evt.target.value
                 });
              }} requiredText={required.role}></RoleRadio>
            </FormControl>
            <CustomButton name={t('home.room_join')} onClick={handleSubmit}/>
          </div>
        </div>
      </div>
    </div>
  )
}
export default React.memo(HomePage);