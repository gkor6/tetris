import { useCallback, useRef } from 'react';

const useCaching = (func) => {
  const cache = useRef(new Map);

  return useCallback((...args) => {
    let subcache = cache.current;

    outer: for (let i = 0; i < args.length - 1; i++) {
      if (subcache.has(args[i])) {
        subcache = subcache.get(args[i]);
        continue;
      }

      for (let j = i; j < args.length - 1; j++) {
        const newSubcache = new Map;

        subcache.set(args[j], newSubcache);
        subcache = newSubcache;
      }

      break outer;
    }

    const lastArgument = args.at(args.length - 1);

    if (!subcache.has(lastArgument)) {
      subcache.set(lastArgument, func.apply(this, args));
    }

    return subcache.get(lastArgument);
  }, [func]);
};

export { useCaching };