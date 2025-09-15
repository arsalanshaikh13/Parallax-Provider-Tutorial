// import ParallaxProvider from "../parallaxturtle/src/index.js";
// import ParallaxProvider from "../parallaxturtle/dist/parallax-provider.es.js";
// import ParallaxProvider from '../../src';
// downloaded the npm library which i published and using that library here from node_modules
// import ParallaxProvider from 'parallax-provider-tutorial-library';
// import ParallaxProvider from 'parallaxturtlelib';
import ParallaxProvider from 'parallaxturtlelibcircle';
console.log(ParallaxProvider);
// https://hungryturtlecode.com/projects/parallax-rewrite/  - using the library
const fg = document.querySelector('.foreground');
const mg = document.querySelector('.middleground');
const bg = document.querySelector('.background');
const title = document.querySelector('.firstpage h1');
const firstpage = document.querySelector('.firstpage');
const titleParts = document.querySelectorAll('.secondpage .heading span');
const mascotImg = document.querySelector('.turtlemascot');
const app = document.querySelector('#app');
const imgs = document.querySelectorAll('.img');
const progressLine = document.querySelector('.progress-line');

function phaseOne(offset, duration) {
  if (offset < duration) {
    //inside the section
    const perc = offset / duration;
    fg.style.transform = `scale( ${1 + 0.4 * perc})`;
    mg.style.transform = `scale(${1 + 0.1 * perc})`;
    bg.style.transform = `scale(${1 + 0.04 * perc})`;
    title.style.transform = `scale(${1 + 0.35 * perc})`;
  } else {
    //after the section
    title.style.transform = `scale(1.35)`;
    fg.style.transform = `scale(1.4)`;
    mg.style.transform = `scale(1.2)`;
    bg.style.transform = `scale(1.04)`;
  }
}

function phaseOneTransition(offset, duration) {
  if (offset < 0) {
    //before
    firstpage.style.opacity = '1';
  } else if (offset < duration) {
    //during
    // firstpage.style.display = "block";

    const perc = offset / duration;
    firstpage.style.opacity = `${1 - perc}`;
  } else {
    //after
    firstpage.style.opacity = '0';
    // firstpage.style.display = "none";
  }
}

function phaseTwo(offset, duration) {
  const MIDDLE_TRIGGER = 250;
  if (offset < 0) {
    //before
    titleParts[0].style.transform = `translate3d(0,0,0)`;
    titleParts[1].style.transform = `translate3d(0,0,0)`;
    titleParts[2].style.transform = `translate3d(0,0,0)`;
  } else if (offset < duration) {
    //duration
    titleParts[0].style.display = 'inline-block';
    titleParts[1].style.display = 'inline-block';
    titleParts[2].style.display = 'inline-block';

    titleParts[0].style.transform = `translate3d(0,-${offset}px,0)`;
    titleParts[1].style.transform = `translate3d(0,0,0)`;
    titleParts[2].style.transform = `translate3d(0,${offset}px,0)`;

    if (offset > MIDDLE_TRIGGER) {
      titleParts[1].style.transform = `translate3d(-${
        offset - MIDDLE_TRIGGER
      }px,0,0)`;
    }
  } else if (offset > duration) {
    //after
    titleParts[0].style.display = 'none';
    titleParts[1].style.display = 'none';
    titleParts[2].style.display = 'none';
  }
}

function turtleExpand(offset, duration) {
  if (offset < 0) {
    //before
    mascotImg.style.transform = 'scale(0)';
  } else if (offset < duration) {
    //during

    const scaleAmt = easeOutBack(offset, 0, 1.1, duration);
    mascotImg.style.transform = `scale(${scaleAmt})`;
  }
  // else {
  //   //after
  //   mascotImg.style.transform = `scale(1.2)`;
  // }
}

// Tweening
function easeOutBack(t, b, c, d, s) {
  let v = s;
  let p = t;
  if (s === undefined) v = 1.70158;
  const val = c * ((p = p / d - 1) * p * ((v + 1) * p + v) + 1) + b;
  return val;
}

function calcScroll(offset, duration) {
  if (offset < 0) {
    //before
    app.style.transform = `translate3d(0,0,0)`;
  } else if (offset < duration) {
    app.style.transform = `translate3d(0,-${offset}px,0)`;
    imgs[0].style.transform = `translate3d(0,-${offset * 0.1}px,0)`;
    imgs[1].style.transform = `translate3d(0,-${offset * 0.25}px,0)`;

    // progressbar animation phase
    const progressTrigger = duration * 0.2;
    if (offset > progressTrigger) {
      const progressDur = duration - progressTrigger;
      const progressOff = offset - progressTrigger;
      const progress = Math.min(1, progressOff / progressDur) * 100;
      progressLine.style.transform = `translate3d(0,-${100 - progress}%,0)`;
    } else {
      progressLine.style.transform = `translate3d(0,-100%,0)`;
    }
  }
}

export default new ParallaxProvider([
  {
    mountPoint: 0,
    duration: 1000,
    controller: phaseOne,
  },
  {
    mountPoint: 0,
    duration: 300,
    controller: phaseOneTransition,
  },
  {
    mountPoint: 0,
    duration: 1000,
    controller: phaseTwo,
  },
  {
    mountPoint: -500,
    duration: 500,
    controller: turtleExpand,
  },
  {
    mountPoint: 100,
    // duration: () => getHeightOfEl(thirdpage),
    duration: 1000,
    controller: calcScroll,
  },
]);
