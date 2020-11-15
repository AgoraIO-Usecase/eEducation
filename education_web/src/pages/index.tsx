import React from 'react';
import { Route, HashRouter } from 'react-router-dom';
import ThemeContainer from '../containers/theme-container';
import Home from './home';
import {DeviceDetectPage} from './device-detect/index';
import { RoomPage } from './classroom';
import Loading from '../components/loading';
import {Toast} from '../components/toast';
import '../icons.scss';
import {SmallClass} from './classroom/small-class';
import {BreakoutClassroom} from './breakout-class/breakout-class';
import {OneToOne} from './classroom/one-to-one';
import {BigClass} from './classroom/big-class';
import RoomDialog from '../components/dialog';
import { ReplayPage } from './replay';
import {Provider} from 'mobx-react';
import { AppStore } from '@/stores/app';
import {AssistantCoursesPage} from './breakout-class/assistant-courses-page';

const defaultStore = new AppStore()
//@ts-ignore
window.store = defaultStore

export default function () {
  return (
    <Provider store={defaultStore}>
      <ThemeContainer>
        <HashRouter>
          <Loading />
          <Toast />
          <RoomDialog />
          <Route path="/setting">
            <DeviceDetectPage />
          </Route>
          <Route exact path="/classroom/one-to-one">
            <RoomPage >
              <OneToOne />
            </RoomPage>
          </Route>
          <Route exact path="/classroom/small-class">
            <RoomPage>
              <SmallClass />
            </RoomPage>
          </Route>
          <Route exact path="/classroom/big-class">
            <RoomPage>
              <BigClass />
            </RoomPage>
          </Route>
          <Route exact path="/breakout-class/assistant/courses/:course_name">
            <BreakoutClassroom />
          </Route>
          <Route exact path="/breakout-class/assistant/courses">
            <AssistantCoursesPage />
          </Route>
          <Route exact path="/classroom/breakout-class">
            <BreakoutClassroom />
          </Route>
          <Route path="/replay/record/:roomUuid">
            <ReplayPage />
          </Route>
          <Route exact path="/lecture/:roomName/:roomType/:userType">
            <Home />
          </Route>
          <Route exact path="/">
            <Home />
          </Route>
        </HashRouter>
      </ThemeContainer>
    </Provider>
  )
}
