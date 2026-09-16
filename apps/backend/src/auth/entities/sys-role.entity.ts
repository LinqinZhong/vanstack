import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SysUser } from './sys-user.entity';

@Entity({ name: 'sys_role' })
export class SysRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'simple-json' })
  permissions: string[];

  @ManyToMany(() => SysUser, (user) => user.roles)
  users: SysUser[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
