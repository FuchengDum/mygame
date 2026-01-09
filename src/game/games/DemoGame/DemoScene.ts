import Phaser from 'phaser'

export class DemoScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle
  private cursors!: { up: boolean; down: boolean; left: boolean; right: boolean; jump: boolean }

  constructor() {
    super('DemoScene')
    this.cursors = { up: false, down: false, left: false, right: false, jump: false }
  }

  create() {
    // 地面
    const ground = this.add.rectangle(400, 580, 800, 40, 0x4a4a6a)
    this.physics.add.existing(ground, true)

    // 平台
    const platform = this.add.rectangle(400, 400, 200, 20, 0x4a4a6a)
    this.physics.add.existing(platform, true)

    // 玩家
    this.player = this.add.rectangle(400, 300, 40, 40, 0xff00ff)
    this.physics.add.existing(this.player)
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setCollideWorldBounds(true)
    body.setBounce(0.1)

    this.physics.add.collider(this.player, ground)
    this.physics.add.collider(this.player, platform)

    // 提示文字
    this.add.text(400, 50, '使用虚拟控制器移动', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5)
  }

  update() {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const speed = 200

    if (this.cursors.left) body.setVelocityX(-speed)
    else if (this.cursors.right) body.setVelocityX(speed)
    else body.setVelocityX(0)

    if (this.cursors.jump && body.blocked.down) {
      body.setVelocityY(-350)
    }
  }

  setInput(input: { direction?: string; action?: string }) {
    this.cursors.left = input.direction === 'left'
    this.cursors.right = input.direction === 'right'
    this.cursors.up = input.direction === 'up'
    this.cursors.down = input.direction === 'down'
    this.cursors.jump = input.action === 'A'
  }
}
