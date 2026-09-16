import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Document } from '../documents/document.entity';

@Entity({ name: 'file_objects' })
export class FileObject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 512 })
  storageKey: string;

  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'varchar', length: 128 })
  mimeType: string;

  @Column({ type: 'integer', default: 0 })
  size: number;

  @ManyToOne(() => Document, (document) => document.files, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  document: Document | null;

  @CreateDateColumn()
  createdAt: Date;
}
