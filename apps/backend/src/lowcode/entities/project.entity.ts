import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProjectLangValue } from './project-lang-value.entity';
import { ProjectLang } from './project-lang.entity';
import { ProjectPage } from './project-page.entity';

@Entity({ name: 'project' })
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 4000, default: '' })
  description: string;

  @OneToMany(() => ProjectPage, (page) => page.project, { cascade: true })
  pages: ProjectPage[];

  @OneToMany(() => ProjectLang, (lang) => lang.project, { cascade: true })
  langs: ProjectLang[];

  @OneToMany(() => ProjectLangValue, (value) => value.project, { cascade: true })
  langValues: ProjectLangValue[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
