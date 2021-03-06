import throttle from 'lodash/throttle'
import { attemptCall } from '@utils/helpers/performance-helpers'
import { Point } from '@utils/helpers/vector-helpers'
import MouseTracker from '@utils/mouse-tracker'
import Hitbox from './hitbox'

type Axis = 'x' | 'y'

const RELEASE_TOUCH_SPEED = 50

class InteractiveVertex {
  current: Point
  control: Point
  initial: Point
  hitbox: null | Hitbox
  velocity: Point = { x: 0, y: 0 }

  constructor(
    anchor: boolean,
    x: number,
    y: number,
    angle: number,
    vertexSeparation: number,
    private readonly mouse: MouseTracker,
    private readonly hitCallback: () => void,
    hitboxWidth: number
  ) {
    this.current = { x, y }
    this.initial = { x, y }
    this.control = { x, y }

    this.hitbox = anchor
      ? null
      : new Hitbox(this.current, angle, vertexSeparation, hitboxWidth)

    this.handleRelease = throttle(this.handleRelease, 400, {
      leading: true,
      trailing: false,
    })
  }

  private handleDrag = (): void => {
    this.current.x =
      (this.mouse.current.x - this.initial.x) * 0.8 + this.initial.x
    this.current.y =
      (this.mouse.current.y - this.initial.y) * 0.8 + this.initial.y
  }

  private handleRelease = (): void => {
    this.velocity.x =
      ((this.mouse.direction.x || 1) * this.mouse.speed ||
        RELEASE_TOUCH_SPEED) / 50
    this.velocity.y =
      ((this.mouse.direction.y || 1) * this.mouse.speed ||
        RELEASE_TOUCH_SPEED) / 50

    attemptCall(this.hitCallback)
  }

  render(viscosity: number, damping: number, hitboxWidth: number): void {
    this.lerpVertex('x', viscosity, damping)
    this.lerpVertex('y', viscosity, damping)

    if (this.hitbox) {
      this.hitbox.setCoordsByCenter(this.current, hitboxWidth)

      if (!this.mouse.drawing && this.mouse.speed) {
        this.hitbox.hitTest(
          this.mouse.current,
          this.handleDrag,
          this.handleRelease
        )
      } else if (this.wasDragCancelled) {
        this.hitbox.endHit(this.handleRelease)
      }
    }
  }

  /**
   * Set the control point between this and the next vertex
   * Used to create bezier curves via canvas context bezierCurveTo
   * @param nextVertex
   */
  setControlPoint(nextVertex: InteractiveVertex): void {
    this.control.x = (this.current.x + nextVertex.current.x) / 2
    this.control.y = (this.current.y + nextVertex.current.y) / 2
  }

  private get wasDragCancelled(): boolean {
    return (
      this.hitbox.hitting &&
      this.hasMoved &&
      !this.lerping &&
      !this.mouse.drawing &&
      !this.mouse.touching
    )
  }

  private get lerping(): boolean {
    return this.velocity.x !== 0 || this.velocity.y !== 0
  }

  private get hasMoved(): boolean {
    return (
      this.current.x !== this.initial.x || this.current.y !== this.initial.y
    )
  }

  private lerpVertex(axis: Axis, viscosity: number, damping: number): void {
    if (this.velocity[axis] < -0.01 || this.velocity[axis] > 0.01) {
      this.applyForce(axis, damping)

      if (!this.hitbox || !this.hitbox.hitting) {
        this.dampen(axis, viscosity)
      }
    } else if (this.velocity[axis] !== 0) {
      this.velocity[axis] = 0
      this.current[axis] = this.initial[axis]
    }
  }

  private dampen(axis: Axis, viscosity: number): void {
    this.velocity[axis] += (this.initial[axis] - this.current[axis]) / viscosity
  }

  private applyForce(axis: Axis, damping: number): void {
    this.velocity[axis] *= 1 - damping
    this.current[axis] += this.velocity[axis]
  }
}

export default InteractiveVertex
