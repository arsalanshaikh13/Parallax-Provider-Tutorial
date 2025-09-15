// https://github.com/adiman9/ParallaxProvider/tree/master
// https://hungryturtlecode.com/projects/parallax-library/

export default class ParallaxProvider {
  constructor(modules) {
    if (modules && modules.length) {
      this.modules = modules;
      this.init();
    }
  }
  init() {
    const newModules = [];
    for (let i = 0; i < this.modules.length; i++) {
      const module = this.modules[i];

      const numNewModules = newModules.length;
      const previousModules = numNewModules
        ? newModules[newModules.length - 1]
        : null;

      let endPreviousModules = 0;
      if (previousModules) {
        //code
        const prevDuration = previousModules.duration;
        endPreviousModules = previousModules._absMountPoint + prevDuration;
      }

      const absMountPoint = endPreviousModules + module.mountPoint;
      module._absMountPoint = absMountPoint;

      newModules.push(module);
    }

    //to get acces to _absMountPoint
    this.modules = newModules;
    this.listenToScroll();
  }

  listenToScroll() {
    document.addEventListener('scroll', () => {
      //code

      const yoff = window.pageYOffset; //window.scrollY
      this.modules.forEach((module) => {
        const duration = module.duration;
        // console.log(
        //   yoff,
        //   module,
        //   //duration,
        //   // module._absMountPoint,
        //   yoff - module._absMountPoint,
        //   'offset ',
        // );
        module.controller(yoff - module._absMountPoint, duration);
      });
    });
  }
}
