// https://hungryturtlecode.com/projects/parallax-tests/
import ParallaxProvider from '../src';

let events = {};
beforeEach(() => {
  events = {};
  //   global.addEventListener = jest.fn((event, callBack) => { global means window in dom
  // that's why it failed the test by not calling callback on scroll
  // , we are using document.addeventlistener in parallaxProvider class

  global.document.addEventListener = jest.fn((event, callBack) => {
    events[event] = callBack;
  });
});
// events.scroll();

describe('scroll events', () => {
  let sectionOneDur = 500;
  let sectionTwoDur = 800;
  let sectionOneCtrl = jest.fn();
  let sectionTwoCtrl = jest.fn();
  beforeEach(() => {
    const p = new ParallaxProvider([
      {
        mountPoint: 0,
        duration: sectionOneDur,
        controller: sectionOneCtrl,
      },
      {
        mountPoint: 0,
        duration: sectionTwoDur,
        controller: sectionTwoCtrl,
      },
    ]);
  });

  test('calls the addEventListener for the scroll event', () => {
    expect(global.document.addEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
    );
  });

  test('it should call the controller', () => {
    events.scroll();

    expect(sectionOneCtrl).toHaveBeenCalled();
  });

  test('correct offset when inside the section', () => {
    global.pageYOffset = 10;
    events.scroll();
    expect(sectionOneCtrl).toHaveBeenCalledWith(
      global.pageYOffset,
      sectionOneDur,
    );
  });

  test('correct offset when inside the section', () => {
    global.pageYOffset = 10000;
    events.scroll();
    expect(sectionOneCtrl).toHaveBeenCalledWith(
      global.pageYOffset,
      sectionOneDur,
    );
  });
  test('correct offset before section two', () => {
    global.pageYOffset = 10;
    events.scroll();

    expect(sectionTwoCtrl).toHaveBeenCalledWith(
      global.pageYOffset - sectionOneDur,
      sectionTwoDur,
    );
  });
  test('correct offset inside section two', () => {
    global.pageYOffset = 550;
    events.scroll();

    expect(sectionTwoCtrl).toHaveBeenCalledWith(
      global.pageYOffset - sectionOneDur,
      sectionTwoDur,
    );
  });
  test('correct offset after section two', () => {
    global.pageYOffset = 1000;
    events.scroll();

    expect(sectionTwoCtrl).toHaveBeenCalledWith(
      global.pageYOffset - sectionOneDur,
      sectionTwoDur,
    );
  });
});

test('it should handle negative mount points', () => {
  let sectionCtrl = jest.fn();
  let sectionDur = 800;
  let sectionMountPoint = -500;

  const p = new ParallaxProvider([
    {
      mountPoint: 0,
      duration: 500,
      controller: () => {},
    },
    {
      mountPoint: sectionMountPoint,
      duration: sectionDur,
      controller: sectionCtrl,
    },
  ]);

  global.pageYOffset = -500;

  events.scroll();
  // console.log(sectionCtrl.mock.calls, 'TESTING MOCK CALLS');
  expect(sectionCtrl).toHaveBeenCalledWith(global.pageYOffset, sectionDur);
});
