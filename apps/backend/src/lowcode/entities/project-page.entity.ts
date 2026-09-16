import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { ProjectPageVersion } from './project-page-version.entity';

@Entity({ name: 'project_page' })
@Unique(['projectId', 'key'])
export class ProjectPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'varchar', length: 36 })
  projectId: string;

  @ManyToOne(() => Project, (project) => project.pages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'varchar', length: 4000, default: '' })
  description: string;

  @Column({ name: 'current_version_id', type: 'varchar', length: 36, nullable: true })
  currentVersionId: string | null;

  @Column({ name: 'xml_key', type: 'varchar', length: 512, default: '' })
  xmlKey: string;

  @Column({ name: 'xml_url', type: 'varchar', length: 1024, default: '' })
  xmlUrl: string;

  @OneToMany(() => ProjectPageVersion, (version) => version.page, { cascade: true })
  versions: ProjectPageVersion[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
