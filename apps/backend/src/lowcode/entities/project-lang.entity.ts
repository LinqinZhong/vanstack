import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Project } from './project.entity';

@Entity({ name: 'project_lang' })
@Unique(['projectId', 'key'])
export class ProjectLang {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'varchar', length: 36 })
  projectId: string;

  @ManyToOne(() => Project, (project) => project.langs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 8, default: 'ltr' })
  dir: 'ltr' | 'rtl';

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
