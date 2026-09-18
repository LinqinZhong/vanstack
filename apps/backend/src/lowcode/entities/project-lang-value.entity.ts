import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Project } from './project.entity';

@Entity({ name: 'project_lang_value' })
@Unique(['projectId', 'groupKey', 'entryKey', 'langKey'])
export class ProjectLangValue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'varchar', length: 36 })
  projectId: string;

  @ManyToOne(() => Project, (project) => project.langValues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'group_key', type: 'varchar', length: 64 })
  groupKey: string;

  @Column({ name: 'entry_key', type: 'varchar', length: 64 })
  entryKey: string;

  @Column({ name: 'lang_key', type: 'varchar', length: 64 })
  langKey: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
