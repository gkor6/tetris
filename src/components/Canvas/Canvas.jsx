import { useCallback, useEffect, useRef } from 'react';
import { useCaching } from '../../hooks';
import { useCachingPrevious } from '../../hooks';
import styles from './Canvas.module.css';
import { random } from '../../utils';

const CANVAS_LOGICAL_WIDTH = 150;
const CANVAS_LOGICAL_HEIGHT = 300;

const TILE_COUNT_X = 10;
const TILE_COUNT_Y = 20;

const TILE_LOGICAL_WIDTH = CANVAS_LOGICAL_WIDTH / TILE_COUNT_X;
const TILE_LOGICAL_HEIGHT = CANVAS_LOGICAL_HEIGHT / TILE_COUNT_Y;

const FIGURE_TYPES = {
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7
};

const FIGURE_COLORS = ['red', 'green', 'blue', 'orange', 'yellow', 'purple'];


const Canvas = () => {
  const canvas = useRef(null);
  const ctx = useRef(null);

  const canvasCssWidth = useRef(null);
  const canvasCssHeight = useRef(null);

  const toTiles = useCallback((value, valueAxis) => Math.floor(value / ((valueAxis === 'x') ? (TILE_LOGICAL_WIDTH) :
    (TILE_LOGICAL_HEIGHT))), []);

  const field = useRef(null);
  const collapsedRowCount = useRef(null);
  const getLevel = useCallback(() => Math.floor(collapsedRowCount.current / 10) + 1, []);
  const getFallingDelay = useCallback(() => 1000 ** (1 - 0.025 * (getLevel() - 1)), [getLevel]); /* the time needed to fall
    one tile */

  const figureType = useRef(null);
  const figureColor = useRef(null);
  const figureRotation = useRef(null);
  const figurePrimaryOffsetX = useRef(null);
  const figureSecondaryOffsetX = useRef(null);
  const getFigureTotalOffsetX = useCallback(() => figurePrimaryOffsetX.current + figureSecondaryOffsetX.current, []);
  const calculateFigureMatrix = useCaching(useCallback((type, rotation) => {
    const matrix = [];

    switch (type) {
      case FIGURE_TYPES.I:
        matrix[0] = [true, true, true, true];
        break;
      case FIGURE_TYPES.O:
        matrix[0] = [true, true];
        matrix[1] = [true, true];
        break;
      case FIGURE_TYPES.T:
        matrix[0] = [false, true, false];
        matrix[1] = [true, true, true];
        break;
      case FIGURE_TYPES.S:
        matrix[0] = [false, true, true];
        matrix[1] = [true, true, false];
        break;
      case FIGURE_TYPES.Z:
        matrix[0] = [true, true, false];
        matrix[1] = [false, true, true];
        break;
      case FIGURE_TYPES.J:
        matrix[0] = [true, false, false];
        matrix[1] = [true, true, true];
        break;
      case FIGURE_TYPES.L:
        matrix[0] = [false, false, true];
        matrix[1] = [true, true, true];
        break;
    }

    const prepareMatrix = (matrixClone) => {
      for (let i = 0; i < matrixClone[0].length; i++) {
        matrix[i] = new Array(matrixClone.length);
      }
    };

    if (type !== FIGURE_TYPES.O) {
      switch (rotation) {
        case 0: {
          break;
        }
        case 90: {
          if (type === FIGURE_TYPES.I || type === FIGURE_TYPES.S || type === FIGURE_TYPES.Z) {
            break;
          }

          const matrixClone = [...matrix];

          matrixClone.forEach((part, partIndex) => {
            const destPartIndex = matrixClone.length - 1 - partIndex;

            part.forEach((tile, tileIndex) => {
              matrix[destPartIndex][part.length - 1 - tileIndex] = tile;
            });
          });

          break;
        }
        case 45: {
          if (type !== FIGURE_TYPES.I || type !== FIGURE_TYPES.S || type !== FIGURE_TYPES.Z) { /* otherwise 
          the matrix gets rotated as if the figure rotation is 135 */
            const matrixClone = [...matrix];
            prepareMatrix(matrixClone);

            matrixClone.forEach((part, partIndex) => {
              const destTileIndex = matrixClone.length - 1 - partIndex;

              part.forEach((tile, tileIndex) => {
                matrix[tileIndex][destTileIndex] = tile;
              });
            });

            break;
          }
          // falls through
        }
        case 135: {
          const matrixClone = [...matrix];
          prepareMatrix(matrixClone);

          matrixClone.forEach((part, partIndex) => {
            part.forEach((tile, tileIndex) => {
              matrix[part.length - 1 - tileIndex][partIndex] = tile;
            });
          });

          break;
        }
      }
    }

    return matrix;
  }, []));
  const getFigureMatrix = useCallback(() => calculateFigureMatrix(figureType.current, figureRotation.current),
    [calculateFigureMatrix]);
  const figureOffsetYFromBottom = useRef(null);
  const calculateFigureOffsetYFromTop = useCachingPrevious(useCallback((offsetYFromBottom) => (TILE_COUNT_Y - 1
    - getFigureMatrix().length + 1) * TILE_LOGICAL_HEIGHT - offsetYFromBottom, [getFigureMatrix]));
  const getFigureOffsetYFromTop = useCallback(() => calculateFigureOffsetYFromTop(figureOffsetYFromBottom.current),
    [calculateFigureOffsetYFromTop]);

  const manualFigureLoweringSeries = useRef(null);
  const isManualFigureLoweringStopNeeded = useRef(null);

  const initializeNewFigure = useCallback(() => {
    figureType.current = random(1, Object.keys(FIGURE_TYPES).length - 1);

    const prevFigureColor = figureColor.current;
    do {
      figureColor.current = FIGURE_COLORS[random(0, FIGURE_COLORS.length - 1)];
    } while (figureColor.current === prevFigureColor)

    figureRotation.current = 0;
    figurePrimaryOffsetX.current = Math.floor((TILE_COUNT_X - getFigureMatrix()[0].length) / 2) * TILE_LOGICAL_WIDTH;
    figureSecondaryOffsetX.current = 0;

    figureOffsetYFromBottom.current = (TILE_COUNT_Y - getFigureMatrix().length - 1) * TILE_LOGICAL_HEIGHT;
    for (let partIndex = getFigureMatrix().length - 1; partIndex >= 0; partIndex--) {
      if (getFigureMatrix()[partIndex].some((tile, tileIndex) => (tile && field.current.at(toTiles(getFigureOffsetYFromTop(),
        'y') + partIndex)?.at(toTiles(figurePrimaryOffsetX.current, 'x') + tileIndex)))) {
        figureOffsetYFromBottom.current += TILE_LOGICAL_HEIGHT;
      }
    }
  }, [getFigureMatrix, toTiles, getFigureOffsetYFromTop]);

  const resetGameData = useCallback(() => {
    field.current = new Array(TILE_COUNT_Y);
    for (let i = 0; i < field.current.length; i++) {
      field.current[i] = (new Array(TILE_COUNT_X)).fill(null);
    }

    collapsedRowCount.current = 0;

    initializeNewFigure();

    manualFigureLoweringSeries.current = 0;
    isManualFigureLoweringStopNeeded.current = false;
  }, [initializeNewFigure]);

  const lowerFigureRoutine = useCallback(({ deltaTime, toNextTile = false }) => {
    const hasFigureLanded = () => {
      if (figureOffsetYFromBottom.current === 0) {
        return true;
      } else {
        outer: for (let tileIndex = 0; tileIndex < getFigureMatrix()[0].length; tileIndex++) {
          for (let partIndex = getFigureMatrix().length - 1; partIndex >= 0; partIndex--) {
            if (!getFigureMatrix()[partIndex][tileIndex]) continue;

            if (field.current[toTiles(getFigureOffsetYFromTop(), 'y') + partIndex + 1][toTiles(getFigureTotalOffsetX(), 'x')
              + tileIndex]) {
              return true;
            }

            continue outer;
          }
        }

        return false;
      }
    };

    const hasPlayerLost = () => getFigureOffsetYFromTop() < 0;

    const saveFigureOnField = () => {
      getFigureMatrix().forEach((part, partIndex) => {
        part.forEach((tile, tileIndex) => {
          if (!tile) return;

          field.current[toTiles(getFigureOffsetYFromTop(), 'y') + partIndex][toTiles(getFigureTotalOffsetX(), 'x')
            + tileIndex] = figureColor.current;
        });
      });
    };

    const getFilledRowIndexes = () => {
      const filledRowIndexes = [];

      for (let partIndex = getFigureMatrix().length - 1; partIndex >= 0; partIndex--) {
        const rowIndex = toTiles(getFigureOffsetYFromTop(), 'y') + partIndex;

        if (field.current[rowIndex].every((tile) => tile !== null)) {
          filledRowIndexes.push(rowIndex);
        }
      }

      return filledRowIndexes;
    }

    const shiftFilledRows = (filledRowIndexes) => {
      for (let rowToShiftIndex = filledRowIndexes[0], shift = 0; rowToShiftIndex >= 0; rowToShiftIndex--) {
        if (filledRowIndexes.includes(rowToShiftIndex)) {
          field.current[rowToShiftIndex].fill(null);
          shift++;
          continue;
        }

        for (let i = 0; i < TILE_COUNT_X; i++) {
          field.current[rowToShiftIndex + shift][i] = field.current[rowToShiftIndex][i];
        }
      }
    };

    if (!hasFigureLanded()) {
      if (!toNextTile) {
        figureOffsetYFromBottom.current = Math.max(figureOffsetYFromBottom.current - deltaTime / getFallingDelay()
          * TILE_LOGICAL_HEIGHT, 0);
      } else {
        const calculateFigureOffsetYFromBottomInTiles = (offsetYFromTopInTiles) => TILE_COUNT_Y - offsetYFromTopInTiles
          - getFigureMatrix().length;

        figureOffsetYFromBottom.current = Math.max(calculateFigureOffsetYFromBottomInTiles(toTiles(
          getFigureOffsetYFromTop(), 'y') + 1) * TILE_LOGICAL_HEIGHT, 0); /* we do this instead of simply substracting 1
          tile from figureOffsetYFromBottom because in the latter case it'll skip 1 tile if it's not exactly on the border
          of a tile and may overlap with already occupied tiles */
      }
      return;
    }

    if (hasPlayerLost()) {
      resetGameData();
      return;
    }

    saveFigureOnField();

    const filledRowIndexes = getFilledRowIndexes();
    shiftFilledRows(filledRowIndexes);

    collapsedRowCount.current += filledRowIndexes.length;

    initializeNewFigure();

    manualFigureLoweringSeries.current = 0;
    isManualFigureLoweringStopNeeded.current = true;
  }, [getFigureMatrix, toTiles, getFigureOffsetYFromTop, getFigureTotalOffsetX, getFallingDelay, resetGameData,
    initializeNewFigure]);

  useEffect(() => {
    const handleArrowLeftDown = (ev) => {
      if (ev.code !== "ArrowLeft") return;

      if (toTiles(figurePrimaryOffsetX.current, 'x') !== 0) {
        figurePrimaryOffsetX.current -= TILE_LOGICAL_WIDTH;
      } else if (toTiles(figureSecondaryOffsetX.current, 'x') !== 0) {
        figureSecondaryOffsetX.current -= TILE_LOGICAL_WIDTH;
      }
    }

    window.addEventListener('keydown', handleArrowLeftDown);
    return () => window.removeEventListener('keydown', handleArrowLeftDown);
  }, [toTiles]);

  useEffect(() => {
    const handleArrowRightDown = (ev) => {
      if (ev.code !== 'ArrowRight' || (toTiles(getFigureTotalOffsetX(), 'width') + getFigureMatrix()[0].length)
        === TILE_COUNT_X) {
        return;
      }

      figurePrimaryOffsetX.current += TILE_LOGICAL_WIDTH;
    }

    window.addEventListener('keydown', handleArrowRightDown);
    return () => window.removeEventListener('keydown', handleArrowRightDown);
  }, [toTiles, getFigureTotalOffsetX, getFigureMatrix]);

  useEffect(() => {
    const handleArrowDownDown = (ev) => {
      if (ev.code !== "ArrowDown") return;

      if (isManualFigureLoweringStopNeeded.current) {
        manualFigureLoweringSeries.current = 0;
        return;
      }

      if (!ev.repeat) {
        manualFigureLoweringSeries.current = 0;
      }

      manualFigureLoweringSeries.current++;

      if (manualFigureLoweringSeries.current !== 5) {
        lowerFigureRoutine({ toNextTile: true });
      } else {
        // drop figure
      }
    };

    window.addEventListener('keydown', handleArrowDownDown);
    return () => window.removeEventListener('keydown', handleArrowDownDown);
  }, [lowerFigureRoutine]);

  useEffect(() => {
    const handleArrowDownUp = (ev) => {
      if (ev.code !== 'ArrowDown') return;

      isManualFigureLoweringStopNeeded.current = false;
    };

    window.addEventListener('keyup', handleArrowDownUp);
    return () => window.removeEventListener('keyup', handleArrowDownUp);
  }, []);

  const adjustCanvasSize = useCallback(() => {
    const { width, height } = canvas.current.getBoundingClientRect();

    if (width !== canvasCssWidth.current || height !== canvasCssHeight.current) {
      canvas.current.width = width * window.devicePixelRatio;
      canvasCssWidth.current = width;

      canvas.current.height = height * window.devicePixelRatio;
      canvasCssHeight.current = height;

      ctx.current.scale(canvas.current.width / CANVAS_LOGICAL_WIDTH, canvas.current.height / CANVAS_LOGICAL_HEIGHT);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', adjustCanvasSize);
    return () => window.removeEventListener('resize', adjustCanvasSize);
  }, [adjustCanvasSize]);

  const clearCanvas = useCallback(() => {
    ctx.current.fillStyle = '#000';
    ctx.current.fillRect(0, 0, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT);
  }, []);

  const renderFigure = useCallback(() => {
    ctx.current.fillStyle = figureColor.current;

    getFigureMatrix().forEach((part, partIndex) => {
      part.forEach((tile, tileIndex) => {
        if (!tile) return;

        ctx.current.fillRect(
          getFigureTotalOffsetX() + tileIndex * TILE_LOGICAL_WIDTH,
          getFigureOffsetYFromTop() + partIndex * TILE_LOGICAL_HEIGHT,
          TILE_LOGICAL_WIDTH,
          TILE_LOGICAL_HEIGHT
        );
      });
    });
  }, [getFigureMatrix, getFigureTotalOffsetX, getFigureOffsetYFromTop]);

  const renderOccupiedTiles = useCallback(() => {
    field.current.forEach((row, rowIndex) => {
      row.forEach((color, colorIndex) => {
        if (!color) return;

        ctx.current.fillStyle = color;
        ctx.current.fillRect(
          colorIndex * TILE_LOGICAL_WIDTH,
          rowIndex * TILE_LOGICAL_HEIGHT,
          TILE_LOGICAL_WIDTH,
          TILE_LOGICAL_HEIGHT
        );
      });
    });
  }, []);

  const render = useCallback(() => {
    clearCanvas();
    renderFigure();
    renderOccupiedTiles();
  }, [clearCanvas, renderFigure, renderOccupiedTiles]);

  useEffect(() => {
    adjustCanvasSize();
    ctx.current.imageSmoothingEnabled = false;

    resetGameData();

    let reqId;
    let timestamp = Date.now();
    const loop = () => {
      const currentTimestamp = Date.now();
      const deltaTime = currentTimestamp - timestamp;
      timestamp = currentTimestamp;

      render();
      lowerFigureRoutine({ deltaTime });
      reqId = window.requestAnimationFrame(loop);
    };
    loop();

    return () => window.cancelAnimationFrame(reqId);
  }, [resetGameData, adjustCanvasSize, render, lowerFigureRoutine]);

  return (
    <canvas
      ref={(node) => {
        canvas.current = node;
        ctx.current = node && node.getContext('2d');
      }}
      className={styles.canvas}
    />
  );
};

export { Canvas };