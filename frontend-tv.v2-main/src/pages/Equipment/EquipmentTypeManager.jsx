import React, { useState } from "react";
import Swal from "sweetalert2";

import api from "../../utils/api";
import stylesEquipment from "./Equipment.module.css";

const EquipmentTypeManager = ({ tipos = [], onRefresh }) => {
    const [editingTipoId, setEditingTipoId] = useState(null);
    const [editingTipoNombre, setEditingTipoNombre] = useState("");

    const handleStartEditTipo = (tipo) => {
        setEditingTipoId(tipo?._id || null);
        setEditingTipoNombre(tipo?.tipoNombre || "");
    };

    const handleCancelEditTipo = () => {
        setEditingTipoId(null);
        setEditingTipoNombre("");
    };

    const handleSaveEditTipo = async () => {
        const normalized = editingTipoNombre.trim().toLowerCase();

        if (!editingTipoId || !normalized) {
            Swal.fire({
                title: "Validación",
                icon: "warning",
                text: "El tipo de equipo no puede estar vacío.",
            });
            return;
        }

        try {
            await api.updateTipoEquipo(editingTipoId, { tipoNombre: normalized });
            Swal.fire({
                title: "Tipo de equipo actualizado",
                icon: "success",
                html: `<p><strong>Tipo:</strong> ${normalized}</p>`,
            });
            handleCancelEditTipo();
            onRefresh?.();
        } catch (error) {
            Swal.fire({
                title: "Error",
                icon: "error",
                text: "No se pudo actualizar el tipo de equipo",
                footer: `${error.response?.data?.message || "Error desconocido"}`,
            });
        }
    };

    const handleDeleteTipo = async (tipo) => {
        if (!tipo?._id) return;

        const displayName = (tipo.tipoNombre || "").trim().toUpperCase();
        const result = await Swal.fire({
            title: "¿Eliminar tipo de equipo?",
            icon: "warning",
            html: `<p>Se eliminará <strong>${displayName || "(sin nombre)"}</strong>.</p>`,
            showCancelButton: true,
            confirmButtonText: "Sí, eliminar",
            cancelButtonText: "Cancelar",
            focusCancel: true,
        });

        if (!result.isConfirmed) return;

        try {
            await api.deleteTipoEquipo(tipo._id);
            Swal.fire({
                title: "Tipo de equipo eliminado",
                icon: "success",
                html: `<p><strong>Tipo:</strong> ${displayName || "(sin nombre)"}</p>`,
            });
            if (editingTipoId === tipo._id) {
                handleCancelEditTipo();
            }
            onRefresh?.();
        } catch (error) {
            Swal.fire({
                title: "Error",
                icon: "error",
                text: "No se pudo eliminar el tipo de equipo",
                footer: `${error.response?.data?.message || "Error desconocido"}`,
            });
        }
    };

    return (
        <section className={stylesEquipment.type__list}>
            <h2 className={stylesEquipment.type__listTitle}>Tipos de equipo registrados</h2>
            {tipos.length === 0 ? (
                <p className={stylesEquipment.type__empty}>Aún no hay tipos de equipo registrados.</p>
            ) : (
                <ul className={stylesEquipment.type__items}>
                    {tipos.map((tipo) => {
                        const displayName = (tipo.tipoNombre || "").trim();
                        const isEditing = editingTipoId === tipo._id;

                        return (
                            <li key={tipo._id} className={stylesEquipment.type__item}>
                                {isEditing ? (
                                    <>
                                        <input
                                            type="text"
                                            value={editingTipoNombre}
                                            onChange={(event) => setEditingTipoNombre(event.target.value)}
                                            className={`form__group-input ${stylesEquipment.type__input}`}
                                            placeholder="Tipo equipo"
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    handleSaveEditTipo();
                                                }
                                                if (event.key === "Escape") {
                                                    event.preventDefault();
                                                    handleCancelEditTipo();
                                                }
                                            }}
                                        />
                                        <div className={stylesEquipment.type__actions}>
                                            <button
                                                type="button"
                                                className="button btn-primary"
                                                onClick={handleSaveEditTipo}
                                            >
                                                Guardar
                                            </button>
                                            <button
                                                type="button"
                                                className="button btn-secondary"
                                                onClick={handleCancelEditTipo}
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <span className={stylesEquipment.type__name}>
                                            {displayName.toUpperCase() || "(SIN NOMBRE)"}
                                        </span>
                                        <div className={stylesEquipment.type__actions}>
                                            <button
                                                type="button"
                                                className="button btn-secondary"
                                                onClick={() => handleStartEditTipo(tipo)}
                                            >
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                className="button btn-danger"
                                                onClick={() => handleDeleteTipo(tipo)}
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};

export default EquipmentTypeManager;
