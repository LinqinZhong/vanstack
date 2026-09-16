import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ProjectPage } from './project-page.entity';

@Entity({ name: 'project_page_version' })
@Unique(['pageId', 'versionNo'])
export class ProjectPageVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'page_id', type: 'varchar', length: 36 })
  pageId: string;

  @ManyToOne(() => ProjectPage, (page) => page.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'page_id' })
  page: ProjectPage;

  @Column({ name: 'version_no', type: 'int' })
  versionNo: number;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: 'draft' | 'published';

  @Column({ type: 'varchar', length: 4000, default: '' })
  description: string;

  @Column({ name: 'xml_key', type: 'varchar', length: 512 })
  xmlKey: string;

  @Column({ name: 'xml_url', type: 'varchar', length: 1024 })
  xmlUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
