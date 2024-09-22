import { useCallback, useRef } from 'react';

const useCachingPrevious = (func) => {
  const prevArgs = useRef([]);
  const prevResult = useRef(null);

  return useCallback((...args) => {  
    if (args.some((arg, argIndex) => !Object.is(arg, prevArgs.current.at(argIndex)))) {
      prevResult.current = func.apply(this, args);
      prevArgs.current = args;
    }

    return prevResult.current;
  }, [func]);
};

export { useCachingPrevious };