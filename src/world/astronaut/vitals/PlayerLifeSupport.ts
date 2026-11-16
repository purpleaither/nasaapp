import { HabitatEvent, type HabitatStatus } from '../../habitat/events.ts'
// ASTRONAUTA — suporte de vida importado de oh-mars e ligado à simulação da missão.
import type { AppBase } from 'playcanvas'
import { LifeSupportEvent } from './events'
import { GeologicalEvent } from '../../geological/crisis.ts'
import { LIFE_SUPPORT_CONFIG } from './config'
import { PlayerEvent, VolcanicEvent, SimulationEvent, type VolcanicStatus, type PlayerBoardingStatePayload } from '../../../systems/events/worldEvents'
import type { DeathCause, VitalRates, VitalsData } from './types'
type PlayerStateData = { isMoving: boolean; isRunning: boolean }

export class PlayerLifeSupport {
    private app: AppBase

    public health = 100
    public oxygen = 100
    public water = 100
    public food = 100

    public isSuffocating = false
    public isCriticalOxygen = false
    public isRecovering = false
    public isGameOver = false
    public deathCause: DeathCause = null

    private phase: VolcanicStatus['phase'] = 'preparation'
    private sheltered = false
    private onHabitat = (s: HabitatStatus): void => { this.sheltered = s.location === 'inside' || s.cycling }
    private isBoarded = true
    private onStatus = (status: VolcanicStatus): void => { this.phase = status.phase }
    private onBoarding = (state: PlayerBoardingStatePayload): void => {
        this.isBoarded = state.isBoarded
        if (state.isBoarded) { this.isMoving = false; this.isRunning = false }
    }

    private isMoving = false
    private isRunning = false
    private criticalOxygenThreshold = 25
    private safeVitalsThreshold = 20

    public rates: VitalRates

    constructor(app: AppBase) {
        this.app = app

        const opts = LIFE_SUPPORT_CONFIG
        this.health = opts.initialHealth
        this.oxygen = opts.initialOxygen
        this.water = opts.initialWater
        this.food = opts.initialFood
        this.criticalOxygenThreshold = opts.criticalOxygenThreshold
        this.safeVitalsThreshold = opts.safeVitalsThreshold
        this.rates = {
            oxygenBaseRate: opts.oxygenBaseRate,
            oxygenWalkMultiplier: opts.oxygenWalkMultiplier,
            oxygenRunMultiplier: opts.oxygenRunMultiplier,
            waterRatePerHour: opts.waterRatePerHour,
            foodRatePerHour: opts.foodRatePerHour,
            suffocationDamageRate: opts.suffocationDamageRate,
            dehydrationDamageRate: opts.dehydrationDamageRate,
            starvationDamageRate: opts.starvationDamageRate,
            healthRecoveryRate: opts.healthRecoveryRate
        }

        this.onPlayerStateChanged = this.onPlayerStateChanged.bind(this)
        this.onKeyDown = this.onKeyDown.bind(this)
        this.refillOxygen = this.refillOxygen.bind(this)
        this.drinkWater = this.drinkWater.bind(this)
        this.eatFood = this.eatFood.bind(this)
        this.respawn = this.respawn.bind(this)
        this.emitVitalsChanged = this.emitVitalsChanged.bind(this)
        this.update = this.update.bind(this)

        this.app.on(HabitatEvent.STATE, this.onHabitat)
        this.app.on(GeologicalEvent.INJURY, this.onGeologicalInjury)
        this.app.on(PlayerEvent.STATE_CHANGED, this.onPlayerStateChanged, this)
        this.app.on(LifeSupportEvent.REFILL_OXYGEN, this.refillOxygen, this)
        this.app.on(LifeSupportEvent.DRINK_WATER, this.drinkWater, this)
        this.app.on(LifeSupportEvent.EAT_FOOD, this.eatFood, this)
        this.app.on(LifeSupportEvent.RESPAWN, this.respawn, this)
        this.app.on(LifeSupportEvent.REQUEST_VITALS, this.emitVitalsChanged, this)
        this.app.on(SimulationEvent.STEP, this.update, this)
        this.app.on(VolcanicEvent.STATUS_CHANGED, this.onStatus, this)
        this.app.on(PlayerEvent.BOARDING_STATE_CHANGED, this.onBoarding, this)

        window.addEventListener('keydown', this.onKeyDown)

        this.emitVitalsChanged()
    }

    public dispose(): void {
        this.app.off(HabitatEvent.STATE, this.onHabitat)
        this.app.off(GeologicalEvent.INJURY, this.onGeologicalInjury)
        this.app.off(PlayerEvent.STATE_CHANGED, this.onPlayerStateChanged, this)
        this.app.off(LifeSupportEvent.REFILL_OXYGEN, this.refillOxygen, this)
        this.app.off(LifeSupportEvent.DRINK_WATER, this.drinkWater, this)
        this.app.off(LifeSupportEvent.EAT_FOOD, this.eatFood, this)
        this.app.off(LifeSupportEvent.RESPAWN, this.respawn, this)
        this.app.off(LifeSupportEvent.REQUEST_VITALS, this.emitVitalsChanged, this)
        this.app.off(SimulationEvent.STEP, this.update, this)
        this.app.off(VolcanicEvent.STATUS_CHANGED, this.onStatus, this)
        this.app.off(PlayerEvent.BOARDING_STATE_CHANGED, this.onBoarding, this)

        window.removeEventListener('keydown', this.onKeyDown)
    }

    private onKeyDown(e: KeyboardEvent): void {
        const target = e.target as HTMLElement | null
        if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
        if (this.isGameOver || this.phase !== 'operation' || e.repeat) return

        const isRefillOxygenKey = e.code === 'KeyO'
        if (isRefillOxygenKey) {
            this.refillOxygen()
            return
        }

        const isDrinkWaterKey = e.code === 'KeyH'
        if (isDrinkWaterKey) {
            this.drinkWater()
            return
        }

        const isEatFoodKey = e.code === 'KeyJ'
        if (isEatFoodKey) {
            this.eatFood()
            return
        }
    }

    private onGeologicalInjury = ({ damage }: { damage: number }): void => {
        if (this.phase !== 'operation' || this.sheltered || this.isBoarded || this.isGameOver || !Number.isFinite(damage) || damage <= 0) return
        this.health = Math.max(0, this.health - damage)
        this.deathCause = 'rockfall'
        if (this.health === 0) {
            this.isGameOver = true
            this.app.fire(LifeSupportEvent.GAME_OVER, { cause: 'rockfall' })
            this.app.fire(VolcanicEvent.PAUSE)
        }
        this.emitVitalsChanged()
    }

    private onPlayerStateChanged(state: PlayerStateData): void {
        this.isMoving = state.isMoving
        this.isRunning = state.isRunning
    }

    public refillOxygen(): void {
        if (this.isGameOver) {
            return
        }

        this.oxygen = 100
        const wasSuffocating = this.isSuffocating
        if (wasSuffocating) {
            this.isSuffocating = false
            this.app.fire(LifeSupportEvent.SUFFOCATION_STOP)
        }

        this.isCriticalOxygen = false
        this.emitVitalsChanged()
    }

    public drinkWater(): void {
        if (this.isGameOver) {
            return
        }

        this.water = 100
        this.emitVitalsChanged()
    }

    public eatFood(): void {
        if (this.isGameOver) {
            return
        }

        this.food = 100
        this.emitVitalsChanged()
    }

    public respawn(): void {
        const opts = LIFE_SUPPORT_CONFIG
        this.health = opts.initialHealth
        this.oxygen = opts.initialOxygen
        this.water = opts.initialWater
        this.food = opts.initialFood
        this.isSuffocating = false
        this.isCriticalOxygen = false
        this.isGameOver = false
        this.deathCause = null
        this.isRecovering = false

        this.app.fire(LifeSupportEvent.SUFFOCATION_STOP)
        this.emitVitalsChanged()
    }

    public update(dt: number): void {
        if (this.phase !== 'operation' || this.sheltered || this.isBoarded) return
        if (this.isGameOver) {
            return
        }

        const delta = Math.min(Math.max(0, dt), 0.1)

        let o2Multiplier = 1.0
        if (this.isMoving) {
            o2Multiplier = this.rates.oxygenWalkMultiplier
        }

        if (this.isRunning) {
            o2Multiplier = this.rates.oxygenRunMultiplier
        }

        const oxygenLoss = this.rates.oxygenBaseRate * o2Multiplier * delta
        this.oxygen = Math.max(0, this.oxygen - oxygenLoss)

        const wasCritical = this.isCriticalOxygen
        this.isCriticalOxygen = this.oxygen > 0 && this.oxygen < this.criticalOxygenThreshold
        const enteredCritical = !wasCritical && this.isCriticalOxygen
        if (enteredCritical && !this.isSuffocating) {
            this.app.fire(LifeSupportEvent.WARNING_TRIGGERED)
        }

        const wasSuffocating = this.isSuffocating
        this.isSuffocating = this.oxygen <= 0
        const startedSuffocating = !wasSuffocating && this.isSuffocating
        if (startedSuffocating) {
            this.app.fire(LifeSupportEvent.WARNING_TRIGGERED)
            this.app.fire(LifeSupportEvent.SUFFOCATION_START)
        }

        const stoppedSuffocating = wasSuffocating && !this.isSuffocating
        if (stoppedSuffocating) {
            this.app.fire(LifeSupportEvent.SUFFOCATION_STOP)
        }

        this.water = Math.max(0, this.water - this.rates.waterRatePerHour * delta)
        this.food = Math.max(0, this.food - this.rates.foodRatePerHour * delta)

        let damage = 0
        let currentCause: DeathCause = null

        if (this.isSuffocating) {
            damage += this.rates.suffocationDamageRate * delta
            if (!currentCause) currentCause = 'asphyxiation'
        }

        const isDehydrated = this.water <= 0
        if (isDehydrated) {
            damage += this.rates.dehydrationDamageRate * delta
            const hasNoCauseYet = !currentCause
            if (hasNoCauseYet) {
                currentCause = 'dehydration'
            }
        }

        const isStarving = this.food <= 0
        if (isStarving) {
            damage += this.rates.starvationDamageRate * delta
            const hasNoCauseYet = !currentCause
            if (hasNoCauseYet) {
                currentCause = 'starvation'
            }
        }

        this.isRecovering = false
        const hasDamage = damage > 0
        if (hasDamage) {
            this.health = Math.max(0, this.health - damage)
            this.deathCause = currentCause
        }

        const hasFullSupplies =
            this.oxygen > this.safeVitalsThreshold &&
            this.water > this.safeVitalsThreshold &&
            this.food > this.safeVitalsThreshold
        const isDamaged = this.health < 100
        const canHeal = damage === 0 && hasFullSupplies && isDamaged
        if (canHeal) {
            this.health = Math.min(100, this.health + this.rates.healthRecoveryRate * delta)
            this.isRecovering = true
            this.deathCause = null
        }

        const isPlayerDead = this.health <= 0
        if (isPlayerDead) {
            this.health = 0
            this.isGameOver = true
            this.app.fire(LifeSupportEvent.GAME_OVER, { cause: this.deathCause })
            this.app.fire(VolcanicEvent.PAUSE)
        }

        this.emitVitalsChanged()
    }

    public getVitalsData(): VitalsData {
        return {
            health: this.health,
            oxygen: this.oxygen,
            water: this.water,
            food: this.food,
            isSuffocating: this.isSuffocating,
            isCriticalOxygen: this.isCriticalOxygen,
            isRecovering: this.isRecovering,
            isGameOver: this.isGameOver,
            deathCause: this.deathCause
        }
    }

    private emitVitalsChanged(): void {
        this.app.fire(LifeSupportEvent.VITALS_CHANGED, this.getVitalsData())
    }
}
